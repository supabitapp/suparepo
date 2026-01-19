export type ConvertOutputFormat = "jpeg" | "png" | "webp" | "gif";
export type RemoveBgOutputFormat = "png" | "webp";
export type BlurMode = "pixelate" | "gaussian" | "solid";
export type Settings = {
  workflowSettings: WorkflowSettings;
  launchAtLogin: boolean;
  showMenuBarIcon: boolean;
  autoUpdate: boolean;
  analyticsTracking: boolean;
};
export type WorkflowSettings = {
  compress: CompressSettings;
  convert: ConvertSettings;
  remove_bg: RemoveBgSettings;
  blur_text: BlurTextSettings;
};
export type CompressSettings = {
  overrideOriginal: boolean;
  stripPngMetadata: boolean;
  stripJpegMetadata: boolean;
};
export type ConvertSettings = {
  outputFormat: ConvertOutputFormat;
  jpegQuality: number;
  pngCompressionLevel: number;
  webpQuality: number;
  webpLossless: boolean;
  gifColors: number;
};
export type RemoveBgSettings = {
  outputFormat: RemoveBgOutputFormat;
};
export type BlurTextSettings = {
  overrideOriginal: boolean;
  blurMode: BlurMode;
  blurStrength: number;
  padding: number;
  confidenceThreshold: number;
  minBoxSize: number;
};
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type SettingsInput = DeepPartial<Settings>;
export const settingsDefaults: Settings = {
  "workflowSettings": {
    "compress": {
      "overrideOriginal": false,
      "stripPngMetadata": true,
      "stripJpegMetadata": true
    },
    "convert": {
      "outputFormat": "jpeg",
      "jpegQuality": 100,
      "pngCompressionLevel": 6,
      "webpQuality": 100,
      "webpLossless": true,
      "gifColors": 256
    },
    "remove_bg": {
      "outputFormat": "png"
    },
    "blur_text": {
      "overrideOriginal": false,
      "blurMode": "gaussian",
      "blurStrength": 12,
      "padding": 6,
      "confidenceThreshold": 0.6,
      "minBoxSize": 8
    }
  },
  "launchAtLogin": false,
  "showMenuBarIcon": true,
  "autoUpdate": true,
  "analyticsTracking": true
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
const coerceEnum = <T extends string>(value: unknown, options: readonly T[], fallback: T) => {
  if (typeof value !== "string") return fallback;
  return options.includes(value as T) ? (value as T) : fallback;
};
const ConvertOutputFormatValues = ["jpeg", "png", "webp", "gif"] as const;
const RemoveBgOutputFormatValues = ["png", "webp"] as const;
const BlurModeValues = ["pixelate", "gaussian", "solid"] as const;
export const normalizeSettings = (input?: SettingsInput): Settings => {
  const value = isRecord(input) ? input : {};
  return {
    workflowSettings: normalizeWorkflowSettings(value.workflowSettings),
    launchAtLogin: coerceBoolean(value.launchAtLogin, settingsDefaults.launchAtLogin),
    showMenuBarIcon: coerceBoolean(value.showMenuBarIcon, settingsDefaults.showMenuBarIcon),
    autoUpdate: coerceBoolean(value.autoUpdate, settingsDefaults.autoUpdate),
    analyticsTracking: coerceBoolean(value.analyticsTracking, settingsDefaults.analyticsTracking),
  };
};
export const normalizeWorkflowSettings = (input?: unknown): WorkflowSettings => {
  const value = isRecord(input) ? input : {};
  return {
    compress: normalizeCompressSettings(value.compress),
    convert: normalizeConvertSettings(value.convert),
    remove_bg: normalizeRemoveBgSettings(value.remove_bg),
    blur_text: normalizeBlurTextSettings(value.blur_text),
  };
};
export const normalizeCompressSettings = (input?: unknown): CompressSettings => {
  const value = isRecord(input) ? input : {};
  return {
    overrideOriginal: coerceBoolean(value.overrideOriginal, settingsDefaults.workflowSettings.compress.overrideOriginal),
    stripPngMetadata: coerceBoolean(value.stripPngMetadata, settingsDefaults.workflowSettings.compress.stripPngMetadata),
    stripJpegMetadata: coerceBoolean(value.stripJpegMetadata, settingsDefaults.workflowSettings.compress.stripJpegMetadata),
  };
};
export const normalizeConvertSettings = (input?: unknown): ConvertSettings => {
  const value = isRecord(input) ? input : {};
  return {
    outputFormat: coerceEnum(value.outputFormat, ConvertOutputFormatValues, settingsDefaults.workflowSettings.convert.outputFormat),
    jpegQuality: coerceNumber(value.jpegQuality, settingsDefaults.workflowSettings.convert.jpegQuality, 60, 100),
    pngCompressionLevel: coerceNumber(value.pngCompressionLevel, settingsDefaults.workflowSettings.convert.pngCompressionLevel, 1, 9),
    webpQuality: coerceNumber(value.webpQuality, settingsDefaults.workflowSettings.convert.webpQuality, 60, 100),
    webpLossless: coerceBoolean(value.webpLossless, settingsDefaults.workflowSettings.convert.webpLossless),
    gifColors: coerceNumber(value.gifColors, settingsDefaults.workflowSettings.convert.gifColors, 2, 256),
  };
};
export const normalizeRemoveBgSettings = (input?: unknown): RemoveBgSettings => {
  const value = isRecord(input) ? input : {};
  return {
    outputFormat: coerceEnum(value.outputFormat, RemoveBgOutputFormatValues, settingsDefaults.workflowSettings.remove_bg.outputFormat),
  };
};
export const normalizeBlurTextSettings = (input?: unknown): BlurTextSettings => {
  const value = isRecord(input) ? input : {};
  return {
    overrideOriginal: coerceBoolean(value.overrideOriginal, settingsDefaults.workflowSettings.blur_text.overrideOriginal),
    blurMode: coerceEnum(value.blurMode, BlurModeValues, settingsDefaults.workflowSettings.blur_text.blurMode),
    blurStrength: coerceNumber(value.blurStrength, settingsDefaults.workflowSettings.blur_text.blurStrength, 2, 40),
    padding: coerceNumber(value.padding, settingsDefaults.workflowSettings.blur_text.padding, 0, 24),
    confidenceThreshold: coerceNumber(value.confidenceThreshold, settingsDefaults.workflowSettings.blur_text.confidenceThreshold, 0.3, 0.9),
    minBoxSize: coerceNumber(value.minBoxSize, settingsDefaults.workflowSettings.blur_text.minBoxSize, 4, 64),
  };
};
