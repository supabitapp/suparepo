import type { PersistStorage } from "zustand/middleware";
import {
  defaultWorkflowSettings,
  type Workflow,
  type WorkflowSettingField,
  type WorkflowSettingsMap,
  workflows,
} from "@/lib/workflows";

export const SETTINGS_STORAGE_KEY = "supaimg-settings";
export const SETTINGS_VERSION = 1;

export type SettingsState = {
  workflowSettings: WorkflowSettingsMap;
  launchAtLogin: boolean;
  showMenuBarIcon: boolean;
  autoUpdate: boolean;
  analyticsTracking: boolean;
};

export type PersistedSettingsState = {
  settings?: Partial<SettingsState>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const coerceNumber = (value: unknown, fallback: number, min?: number, max?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

const coerceEnum = (value: unknown, options: WorkflowSettingField["options"], fallback: string) => {
  if (typeof value !== "string") return fallback;
  const allowed = options?.map((option) => option.value) ?? [];
  return allowed.includes(value) ? value : fallback;
};

const sanitizeWorkflowSetting = (field: WorkflowSettingField, value: unknown) => {
  switch (field.type) {
    case "boolean":
      return coerceBoolean(value, Boolean(field.default));
    case "number":
      return coerceNumber(value, Number(field.default), field.min, field.max);
    case "enum":
      return coerceEnum(value, field.options, String(field.default));
    default:
      return field.default;
  }
};

export const createDefaultWorkflowSettings = (): WorkflowSettingsMap => {
  return {
    compress: { ...defaultWorkflowSettings.compress },
    convert: { ...defaultWorkflowSettings.convert },
    remove_bg: { ...defaultWorkflowSettings.remove_bg },
    blur_text: { ...defaultWorkflowSettings.blur_text },
  };
};

export const createDefaultSettings = (): SettingsState => ({
  workflowSettings: createDefaultWorkflowSettings(),
  launchAtLogin: false,
  showMenuBarIcon: true,
  autoUpdate: true,
  analyticsTracking: true,
});

export const DEFAULT_SETTINGS = createDefaultSettings();

export const sanitizeWorkflowSettings = (
  input?: Partial<WorkflowSettingsMap>,
): WorkflowSettingsMap => {
  const sanitizeForWorkflow = <W extends Workflow>(
    workflow: W,
    rawInput?: Partial<WorkflowSettingsMap[W]>,
  ): WorkflowSettingsMap[W] => {
    const schema = workflows[workflow].settingsSchema;
    const rawRecord = isRecord(rawInput) ? (rawInput as Record<string, unknown>) : undefined;
    const next = {} as Record<string, unknown>;
    schema.forEach((field) => {
      next[field.key] = sanitizeWorkflowSetting(field, rawRecord?.[field.key]);
    });
    return next as WorkflowSettingsMap[W];
  };

  return {
    compress: sanitizeForWorkflow("compress", input?.compress),
    convert: sanitizeForWorkflow("convert", input?.convert),
    remove_bg: sanitizeForWorkflow("remove_bg", input?.remove_bg),
    blur_text: sanitizeForWorkflow("blur_text", input?.blur_text),
  };
};

export const sanitizeSettings = (input?: Partial<SettingsState>): SettingsState => {
  const defaults = createDefaultSettings();
  return {
    ...defaults,
    workflowSettings: sanitizeWorkflowSettings(input?.workflowSettings),
    launchAtLogin: coerceBoolean(input?.launchAtLogin, defaults.launchAtLogin),
    showMenuBarIcon: coerceBoolean(input?.showMenuBarIcon, defaults.showMenuBarIcon),
    autoUpdate: coerceBoolean(input?.autoUpdate, defaults.autoUpdate),
    analyticsTracking: coerceBoolean(input?.analyticsTracking, defaults.analyticsTracking),
  };
};

export const mergeSettings = (
  base: SettingsState,
  input?: Partial<SettingsState>,
): SettingsState => {
  const sanitized = sanitizeSettings(input);
  return { ...sanitized, launchAtLogin: base.launchAtLogin };
};

const coercePersistedState = (input: unknown): PersistedSettingsState => {
  if (!isRecord(input)) return {};
  const settings = isRecord(input.settings) ? input.settings : undefined;
  return { settings: settings as Partial<SettingsState> | undefined };
};

type SettingsMigration = (state: PersistedSettingsState) => PersistedSettingsState;

const settingsMigrations: Record<number, SettingsMigration> = {
  0: (state) => state,
};

const hasStorageMethods = (value: Storage | null): value is Storage =>
  Boolean(
    value &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function",
  );

const getStorage = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      const candidate = globalThis.localStorage as Storage | undefined;
      return candidate ?? null;
    }
  } catch {
    return null;
  }
  return null;
};

export const migratePersistedState = (
  persistedState: unknown,
  version?: number,
): PersistedSettingsState => {
  const startVersion = typeof version === "number" && Number.isFinite(version) ? version : 0;
  let next = coercePersistedState(persistedState);
  if (startVersion < SETTINGS_VERSION) {
    for (let v = startVersion; v < SETTINGS_VERSION; v += 1) {
      const migrate = settingsMigrations[v];
      if (migrate) {
        next = migrate(next);
      }
    }
  }
  return { ...next, settings: sanitizeSettings(next.settings) };
};

export const createSettingsStorage = (): PersistStorage<PersistedSettingsState> => {
  const memory = new Map<string, { state: PersistedSettingsState; version?: number }>();

  const parseValue = (raw: string | null) => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as {
        state: PersistedSettingsState;
        version?: number;
      };
    } catch {
      return null;
    }
  };

  return {
    getItem: (name) => {
      const storage = getStorage();
      if (!hasStorageMethods(storage)) {
        return memory.get(name) ?? null;
      }
      return parseValue(storage.getItem(name));
    },
    setItem: (name, value) => {
      const storage = getStorage();
      if (!hasStorageMethods(storage)) {
        memory.set(name, value);
        return;
      }
      storage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name) => {
      const storage = getStorage();
      if (!hasStorageMethods(storage)) {
        memory.delete(name);
        return;
      }
      storage.removeItem(name);
    },
  };
};
