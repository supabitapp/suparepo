import workflowsData from "../../workflows.json";
import settingsSchema from "@repo/settings/schema.json";
import {
  settingsDefaults,
  type BlurMode,
  type ConvertOutputFormat,
  type RemoveBgOutputFormat,
  type WorkflowSettings,
} from "@repo/settings";

export type Workflow = "compress" | "convert" | "remove_bg" | "blur_text";

export type WorkflowTask = "compress" | "convert" | "remove_bg" | "blur_text";

export type OutputBehavior = "always_copy" | "allow_override";

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

export type WorkflowSettingsMap = WorkflowSettings;

export type WorkflowSettingType = "boolean" | "number" | "enum";

type WorkflowSettingValue = boolean | number | string;

export type WorkflowSettingField = {
  key: string;
  label: string;
  description?: string;
  type: WorkflowSettingType;
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { label: string; value: string }[];
  default: WorkflowSettingValue;
};

type WorkflowConfigBase = {
  id: Workflow;
  title: string;
  actionLabel: string;
  processingLabel: string;
  inputExtensions: readonly string[];
  outputSuffix: string;
  outputExtension: string | null;
  outputBehavior: OutputBehavior;
  task: WorkflowTask;
  route: string;
};

type WorkflowConfig = Omit<WorkflowConfigBase, "outputExtension"> & {
  outputExtension?: string;
  settingsSchema: readonly WorkflowSettingField[];
};

const workflowDefaults = settingsDefaults.workflowSettings;
const workflowSchema = (settingsSchema as {
  properties: {
    workflowSettings: {
      properties: Record<Workflow, { properties: Record<string, unknown> }>;
    };
  };
}).properties.workflowSettings.properties;

const getFieldSchema = (workflow: Workflow, key: string) => {
  const schema = workflowSchema[workflow]?.properties?.[key];
  if (schema && typeof schema === "object") {
    return schema as {
      minimum?: number;
      maximum?: number;
      enum?: string[];
    };
  }
  return {};
};

const getNumberBounds = (workflow: Workflow, key: string) => {
  const schema = getFieldSchema(workflow, key);
  return { min: schema.minimum, max: schema.maximum };
};

const getEnumValues = <T extends string>(workflow: Workflow, key: string) => {
  const schema = getFieldSchema(workflow, key);
  return (schema.enum ?? []) as T[];
};

const convertOutputLabels: Record<ConvertOutputFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
};

const removeBgOutputLabels: Record<RemoveBgOutputFormat, string> = {
  png: "PNG",
  webp: "WebP",
};

const blurModeLabels: Record<BlurMode, string> = {
  pixelate: "Pixelate",
  gaussian: "Gaussian",
  solid: "Solid",
};

const convertOutputOptions = getEnumValues<ConvertOutputFormat>("convert", "outputFormat").map(
  (value) => ({
    label: convertOutputLabels[value],
    value,
  }),
);

const removeBgOutputOptions = getEnumValues<RemoveBgOutputFormat>(
  "remove_bg",
  "outputFormat",
).map((value) => ({
  label: removeBgOutputLabels[value],
  value,
}));

const blurModeOptions = getEnumValues<BlurMode>("blur_text", "blurMode").map((value) => ({
  label: blurModeLabels[value],
  value,
}));

const compressSettingsSchema = [
  {
    key: "overrideOriginal",
    label: "Override original",
    description: "Replace files instead of saving copies",
    type: "boolean",
    default: workflowDefaults.compress.overrideOriginal,
  },
  {
    key: "stripPngMetadata",
    label: "Strip PNG metadata",
    description: "Gamma, color profiles, ancillary chunks",
    type: "boolean",
    group: "Metadata",
    default: workflowDefaults.compress.stripPngMetadata,
  },
  {
    key: "stripJpegMetadata",
    label: "Strip JPEG metadata",
    description: "Orientation, EXIF, GPS, color profiles, etc",
    type: "boolean",
    group: "Metadata",
    default: workflowDefaults.compress.stripJpegMetadata,
  },
] as const satisfies readonly WorkflowSettingField[];

const { min: jpegQualityMin, max: jpegQualityMax } = getNumberBounds(
  "convert",
  "jpegQuality",
);
const { min: pngCompressionMin, max: pngCompressionMax } = getNumberBounds(
  "convert",
  "pngCompressionLevel",
);
const { min: webpQualityMin, max: webpQualityMax } = getNumberBounds(
  "convert",
  "webpQuality",
);
const { min: gifColorsMin, max: gifColorsMax } = getNumberBounds("convert", "gifColors");

const convertSettingsSchema = [
  {
    key: "outputFormat",
    label: "Output format",
    description: "Choose the target format",
    type: "enum",
    options: convertOutputOptions,
    default: workflowDefaults.convert.outputFormat,
  },
  {
    key: "jpegQuality",
    label: "Quality",
    description: "Higher means larger files",
    type: "number",
    min: jpegQualityMin,
    max: jpegQualityMax,
    step: 1,
    default: workflowDefaults.convert.jpegQuality,
    group: "JPEG",
  },
  {
    key: "pngCompressionLevel",
    label: "Compression level",
    description: "Higher means smaller files, slower encoding",
    type: "number",
    min: pngCompressionMin,
    max: pngCompressionMax,
    step: 1,
    default: workflowDefaults.convert.pngCompressionLevel,
    group: "PNG",
  },
  {
    key: "webpQuality",
    label: "Quality",
    description: "Higher means larger files",
    type: "number",
    min: webpQualityMin,
    max: webpQualityMax,
    step: 1,
    default: workflowDefaults.convert.webpQuality,
    group: "WebP",
  },
  {
    key: "webpLossless",
    label: "Lossless",
    description: "Preserve original quality",
    type: "boolean",
    default: workflowDefaults.convert.webpLossless,
    group: "WebP",
  },
  {
    key: "gifColors",
    label: "Colors",
    description: "Lower values produce smaller files",
    type: "number",
    min: gifColorsMin,
    max: gifColorsMax,
    step: 1,
    default: workflowDefaults.convert.gifColors,
    group: "GIF",
  },
] as const satisfies readonly WorkflowSettingField[];

const removeBgSettingsSchema = [
  {
    key: "outputFormat",
    label: "Output format",
    description: "Transparent background format",
    type: "enum",
    options: removeBgOutputOptions,
    default: workflowDefaults.remove_bg.outputFormat,
  },
] as const satisfies readonly WorkflowSettingField[];

const { min: blurStrengthMin, max: blurStrengthMax } = getNumberBounds(
  "blur_text",
  "blurStrength",
);
const { min: paddingMin, max: paddingMax } = getNumberBounds("blur_text", "padding");
const { min: confidenceMin, max: confidenceMax } = getNumberBounds(
  "blur_text",
  "confidenceThreshold",
);
const { min: minBoxSizeMin, max: minBoxSizeMax } = getNumberBounds("blur_text", "minBoxSize");

const blurTextSettingsSchema = [
  {
    key: "overrideOriginal",
    label: "Override original",
    description: "Replace files instead of saving copies",
    type: "boolean",
    default: workflowDefaults.blur_text.overrideOriginal,
    group: "Output",
  },
  {
    key: "blurMode",
    label: "Blur mode",
    description: "Choose how text regions are obscured",
    type: "enum",
    options: blurModeOptions,
    default: workflowDefaults.blur_text.blurMode,
    group: "Blur",
  },
  {
    key: "blurStrength",
    label: "Strength",
    description: "Higher values blur or pixelate more",
    type: "number",
    min: blurStrengthMin,
    max: blurStrengthMax,
    step: 1,
    default: workflowDefaults.blur_text.blurStrength,
    group: "Blur",
  },
  {
    key: "padding",
    label: "Padding",
    description: "Expand detected boxes in pixels",
    type: "number",
    min: paddingMin,
    max: paddingMax,
    step: 1,
    default: workflowDefaults.blur_text.padding,
    group: "Blur",
  },
  {
    key: "confidenceThreshold",
    label: "Confidence",
    description: "Higher values detect fewer regions",
    type: "number",
    min: confidenceMin,
    max: confidenceMax,
    step: 0.05,
    default: workflowDefaults.blur_text.confidenceThreshold,
    group: "Advanced",
  },
  {
    key: "minBoxSize",
    label: "Min box size",
    description: "Ignore tiny detections (pixels)",
    type: "number",
    min: minBoxSizeMin,
    max: minBoxSizeMax,
    step: 2,
    default: workflowDefaults.blur_text.minBoxSize,
    group: "Advanced",
  },
] as const satisfies readonly WorkflowSettingField[];

const settingsSchemaMap: Record<Workflow, readonly WorkflowSettingField[]> = {
  compress: compressSettingsSchema,
  convert: convertSettingsSchema,
  remove_bg: removeBgSettingsSchema,
  blur_text: blurTextSettingsSchema,
};

const baseWorkflows = workflowsData.workflows as WorkflowConfigBase[];

export const workflows = baseWorkflows.reduce<Record<Workflow, WorkflowConfig>>(
  (acc, workflow) => {
    acc[workflow.id] = {
      ...workflow,
      outputExtension: workflow.outputExtension ?? undefined,
      settingsSchema: settingsSchemaMap[workflow.id],
    };
    return acc;
  },
  {} as Record<Workflow, WorkflowConfig>,
);

export const defaultWorkflowSettings: WorkflowSettingsMap = settingsDefaults.workflowSettings;

export const getWorkflow = (workflow: Workflow) => workflows[workflow];

export const convertFormatExtension = (format: ConvertOutputFormat) =>
  format === "jpeg" ? "jpg" : format;
