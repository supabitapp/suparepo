export type Workflow = "compress" | "convert" | "remove_bg" | "blur_text";

export type WorkflowSettingType = "boolean" | "number" | "enum";

export type WorkflowSettingOption = { label: string; value: string };

export type WorkflowSettingValue = boolean | number | string;

export type WorkflowSettingField = {
  key: string;
  label: string;
  description?: string;
  type: WorkflowSettingType;
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly WorkflowSettingOption[];
  default: WorkflowSettingValue;
};

export type ConvertOutputFormat = "jpeg" | "png" | "webp" | "gif";

export type RemoveBgOutputFormat = "png" | "webp";

export type BlurMode = "pixelate" | "gaussian" | "solid";

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

export type WorkflowSettingsMap = {
  compress: CompressSettings;
  convert: ConvertSettings;
  remove_bg: RemoveBgSettings;
  blur_text: BlurTextSettings;
};

export type GeneralSettings = {
  launchAtLogin: boolean;
  showMenuBarIcon: boolean;
  autoUpdate: boolean;
  analyticsTracking: boolean;
};

export type WorkflowSettingsSchema = Record<Workflow, readonly WorkflowSettingField[]>;

export const workflowSettingsSchema = {
  compress: [
    {
      key: "overrideOriginal",
      label: "Override original",
      description: "Replace files instead of saving copies",
      type: "boolean",
      default: false,
    },
    {
      key: "stripPngMetadata",
      label: "Strip PNG metadata",
      description: "Gamma, color profiles, ancillary chunks",
      type: "boolean",
      group: "Metadata",
      default: true,
    },
    {
      key: "stripJpegMetadata",
      label: "Strip JPEG metadata",
      description: "Orientation, EXIF, GPS, color profiles, etc",
      type: "boolean",
      group: "Metadata",
      default: true,
    },
  ],
  convert: [
    {
      key: "outputFormat",
      label: "Output format",
      description: "Choose the target format",
      type: "enum",
      options: [
        {
          label: "JPEG",
          value: "jpeg",
        },
        {
          label: "PNG",
          value: "png",
        },
        {
          label: "WebP",
          value: "webp",
        },
        {
          label: "GIF",
          value: "gif",
        },
      ],
      default: "jpeg",
    },
    {
      key: "jpegQuality",
      label: "Quality",
      description: "Higher means larger files",
      type: "number",
      min: 60,
      max: 100,
      step: 1,
      default: 100,
      group: "JPEG",
    },
    {
      key: "pngCompressionLevel",
      label: "Compression level",
      description: "Higher means smaller files, slower encoding",
      type: "number",
      min: 1,
      max: 9,
      step: 1,
      default: 6,
      group: "PNG",
    },
    {
      key: "webpQuality",
      label: "Quality",
      description: "Higher means larger files",
      type: "number",
      min: 60,
      max: 100,
      step: 1,
      default: 100,
      group: "WebP",
    },
    {
      key: "webpLossless",
      label: "Lossless",
      description: "Preserve original quality",
      type: "boolean",
      default: true,
      group: "WebP",
    },
    {
      key: "gifColors",
      label: "Colors",
      description: "Lower values produce smaller files",
      type: "number",
      min: 2,
      max: 256,
      step: 1,
      default: 256,
      group: "GIF",
    },
  ],
  remove_bg: [
    {
      key: "outputFormat",
      label: "Output format",
      description: "Transparent background format",
      type: "enum",
      options: [
        {
          label: "PNG",
          value: "png",
        },
        {
          label: "WebP",
          value: "webp",
        },
      ],
      default: "png",
    },
  ],
  blur_text: [
    {
      key: "overrideOriginal",
      label: "Override original",
      description: "Replace files instead of saving copies",
      type: "boolean",
      default: false,
      group: "Output",
    },
    {
      key: "blurMode",
      label: "Blur mode",
      description: "Choose how text regions are obscured",
      type: "enum",
      options: [
        {
          label: "Pixelate",
          value: "pixelate",
        },
        {
          label: "Gaussian",
          value: "gaussian",
        },
        {
          label: "Solid",
          value: "solid",
        },
      ],
      default: "gaussian",
      group: "Blur",
    },
    {
      key: "blurStrength",
      label: "Strength",
      description: "Higher values blur or pixelate more",
      type: "number",
      min: 2,
      max: 40,
      step: 1,
      default: 12,
      group: "Blur",
    },
    {
      key: "padding",
      label: "Padding",
      description: "Expand detected boxes in pixels",
      type: "number",
      min: 0,
      max: 24,
      step: 1,
      default: 6,
      group: "Blur",
    },
    {
      key: "confidenceThreshold",
      label: "Confidence",
      description: "Higher values detect fewer regions",
      type: "number",
      min: 0.3,
      max: 0.9,
      step: 0.05,
      default: 0.6,
      group: "Advanced",
    },
    {
      key: "minBoxSize",
      label: "Min box size",
      description: "Ignore tiny detections (pixels)",
      type: "number",
      min: 4,
      max: 64,
      step: 2,
      default: 8,
      group: "Advanced",
    },
  ],
} as const satisfies WorkflowSettingsSchema;

export const workflowSettingsDefaults = {
  compress: {
    overrideOriginal: false,
    stripPngMetadata: true,
    stripJpegMetadata: true,
  },
  convert: {
    outputFormat: "jpeg",
    jpegQuality: 100,
    pngCompressionLevel: 6,
    webpQuality: 100,
    webpLossless: true,
    gifColors: 256,
  },
  remove_bg: {
    outputFormat: "png",
  },
  blur_text: {
    overrideOriginal: false,
    blurMode: "gaussian",
    blurStrength: 12,
    padding: 6,
    confidenceThreshold: 0.6,
    minBoxSize: 8,
  },
} as const satisfies WorkflowSettingsMap;

export const generalSettingsDefaults = {
  launchAtLogin: false,
  showMenuBarIcon: true,
  autoUpdate: true,
  analyticsTracking: true,
} as const satisfies GeneralSettings;
