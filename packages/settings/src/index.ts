export type AppearanceTheme = "system" | "light" | "dark";
export type BlurMode = "pixelate" | "gaussian";
export type OutputFormat = "png" | "jpg" | "webp";
export type Settings = {
  appearance: AppearanceSettings;
  blur: BlurSettings;
  output: OutputSettings;
};
export type AppearanceSettings = {
  theme: AppearanceTheme;
};
export type BlurSettings = {
  mode: BlurMode;
  radius: number;
};
export type OutputSettings = {
  format: OutputFormat;
  quality: number;
};
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type SettingsInput = DeepPartial<Settings>;
export const settingsDefaults: Settings = {
  "appearance": {
    "theme": "system"
  },
  "blur": {
    "mode": "pixelate",
    "radius": 16
  },
  "output": {
    "format": "png",
    "quality": 85
  }
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const normalizeSettings = (input?: SettingsInput): Settings => ({
  appearance: ({
    theme: input?.appearance?.theme ?? settingsDefaults.appearance.theme,
  }),
  blur: ({
    mode: input?.blur?.mode ?? settingsDefaults.blur.mode,
    radius: clamp(input?.blur?.radius ?? settingsDefaults.blur.radius, 1, 64),
  }),
  output: ({
    format: input?.output?.format ?? settingsDefaults.output.format,
    quality: clamp(input?.output?.quality ?? settingsDefaults.output.quality, 1, 100),
  }),
});
