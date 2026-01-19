import type { PersistStorage } from "zustand/middleware";
import {
  normalizeSettings,
  settingsDefaults,
  type Settings,
  type SettingsInput,
  type WorkflowSettings,
} from "@repo/settings";

export const SETTINGS_STORAGE_KEY = "supaimg-settings";
export const SETTINGS_VERSION = 1;

export type SettingsState = Settings;

export type PersistedSettingsState = {
  settings?: SettingsInput;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createDefaultWorkflowSettings = (): WorkflowSettings =>
  normalizeSettings().workflowSettings;

export const createDefaultSettings = (): SettingsState => normalizeSettings();

export const DEFAULT_SETTINGS: SettingsState = settingsDefaults;

export const sanitizeWorkflowSettings = (
  input?: SettingsInput["workflowSettings"],
): WorkflowSettings => normalizeSettings({ workflowSettings: input }).workflowSettings;

export const sanitizeSettings = (input?: SettingsInput): SettingsState => normalizeSettings(input);

export const mergeSettings = (base: SettingsState, input?: SettingsInput): SettingsState => {
  const sanitized = sanitizeSettings(input);
  return { ...sanitized, launchAtLogin: base.launchAtLogin };
};

const coercePersistedState = (input: unknown): PersistedSettingsState => {
  if (!isRecord(input)) return {};
  const settings = isRecord(input.settings) ? input.settings : undefined;
  return { settings: settings as SettingsInput | undefined };
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
