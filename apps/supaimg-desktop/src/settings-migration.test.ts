import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  sanitizeSettings,
} from "@/lib/settings";
import {
  generalSettingsDefaults,
  workflowSettingsDefaults,
} from "@/lib/generated/workflow-settings";
import { useStore } from "@/store";
import { resetStore } from "@/test/test-helpers";

const getPersistStorage = () => {
  const storage = useStore.persist.getOptions().storage;
  if (!storage) {
    throw new Error("Persist storage unavailable in test environment");
  }
  return storage;
};

const writePersistedSettings = (
  key: string,
  settings: unknown,
  version: number = SETTINGS_VERSION,
) => {
  getPersistStorage().setItem(key, { state: { settings }, version });
};

describe("settings migration", () => {
  beforeEach(() => {
    resetStore();
    const storage = getPersistStorage();
    storage.removeItem(SETTINGS_STORAGE_KEY);
  });

  test("sanitizeSettings returns defaults for empty input", () => {
    expect(sanitizeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test("default settings match generated schema defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      workflowSettings: workflowSettingsDefaults,
      ...generalSettingsDefaults,
    });
  });

  test("sanitizeSettings clamps numbers and fixes invalid types", () => {
    const sanitized = sanitizeSettings({
      workflowSettings: {
        compress: {
          overrideOriginal: "no",
          stripPngMetadata: 123,
          stripJpegMetadata: true,
        },
        convert: {
          outputFormat: "tiff",
          jpegQuality: 200,
          pngCompressionLevel: 0,
          webpQuality: 55,
          webpLossless: "yes",
          gifColors: -10,
        },
        remove_bg: {
          outputFormat: "bmp",
        },
        blur_text: {
          overrideOriginal: "yes",
          blurMode: "box",
          blurStrength: -5,
          padding: 999,
          confidenceThreshold: 2,
          minBoxSize: 1,
        },
      },
      showMenuBarIcon: "true",
      autoUpdate: null,
      analyticsTracking: false,
    });

    expect(sanitized.workflowSettings.compress.overrideOriginal).toBe(false);
    expect(sanitized.workflowSettings.compress.stripPngMetadata).toBe(true);
    expect(sanitized.workflowSettings.convert.outputFormat).toBe("jpeg");
    expect(sanitized.workflowSettings.convert.jpegQuality).toBe(100);
    expect(sanitized.workflowSettings.convert.pngCompressionLevel).toBe(1);
    expect(sanitized.workflowSettings.convert.webpQuality).toBe(60);
    expect(sanitized.workflowSettings.convert.webpLossless).toBe(true);
    expect(sanitized.workflowSettings.convert.gifColors).toBe(2);
    expect(sanitized.workflowSettings.remove_bg.outputFormat).toBe("png");
    expect(sanitized.workflowSettings.blur_text.overrideOriginal).toBe(false);
    expect(sanitized.workflowSettings.blur_text.blurMode).toBe("gaussian");
    expect(sanitized.workflowSettings.blur_text.blurStrength).toBe(2);
    expect(sanitized.workflowSettings.blur_text.padding).toBe(24);
    expect(sanitized.workflowSettings.blur_text.confidenceThreshold).toBe(0.9);
    expect(sanitized.workflowSettings.blur_text.minBoxSize).toBe(4);
    expect(sanitized.showMenuBarIcon).toBe(true);
    expect(sanitized.autoUpdate).toBe(true);
    expect(sanitized.analyticsTracking).toBe(false);
  });

  test("rehydrate fills missing settings with defaults", async () => {
    writePersistedSettings(SETTINGS_STORAGE_KEY, {
      workflowSettings: {
        compress: {
          overrideOriginal: true,
        },
      },
    });

    await useStore.persist.rehydrate();

    const settings = useStore.getState().settings;
    expect(settings.workflowSettings.compress.overrideOriginal).toBe(true);
    expect(settings.workflowSettings.compress.stripPngMetadata).toBe(true);
    expect(settings.workflowSettings.convert.outputFormat).toBe("jpeg");
    expect(settings.workflowSettings.remove_bg.outputFormat).toBe("png");
    expect(settings.workflowSettings.blur_text.blurMode).toBe("gaussian");
    expect(settings.showMenuBarIcon).toBe(true);
    expect(settings.autoUpdate).toBe(true);
  });
});
