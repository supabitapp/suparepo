import {
  workflowsData,
  type OutputBehavior,
  type Workflow,
  type WorkflowTask,
} from "./workflows.generated";

export type { OutputBehavior, Workflow, WorkflowTask } from "./workflows.generated";

export type RemoveBgOutputFormat = "png" | "webp";

export type ConvertOutputFormat = "jpeg" | "png" | "webp" | "gif";

export type BlurMode = "gaussian" | "pixelate" | "solid";

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

const compressSettingsSchema = [
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
] as const satisfies readonly WorkflowSettingField[];

const convertSettingsSchema = [
  {
    key: "outputFormat",
    label: "Output format",
    description: "Choose the target format",
    type: "enum",
    options: [
      { label: "JPEG", value: "jpeg" },
      { label: "PNG", value: "png" },
      { label: "WebP", value: "webp" },
      { label: "GIF", value: "gif" },
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
] as const satisfies readonly WorkflowSettingField[];

const removeBgSettingsSchema = [
  {
    key: "outputFormat",
    label: "Output format",
    description: "Transparent background format",
    type: "enum",
    options: [
      { label: "PNG", value: "png" },
      { label: "WebP", value: "webp" },
    ],
    default: "png",
  },
] as const satisfies readonly WorkflowSettingField[];

const blurTextSettingsSchema = [
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
      { label: "Pixelate", value: "pixelate" },
      { label: "Gaussian", value: "gaussian" },
      { label: "Solid", value: "solid" },
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
] as const satisfies readonly WorkflowSettingField[];

const settingsSchemaMap: Record<Workflow, readonly WorkflowSettingField[]> = {
  compress: compressSettingsSchema,
  convert: convertSettingsSchema,
  remove_bg: removeBgSettingsSchema,
  blur_text: blurTextSettingsSchema,
};

const buildDefaults = (schema: readonly WorkflowSettingField[]) =>
  schema.reduce<Record<string, WorkflowSettingValue>>((acc, field) => {
    acc[field.key] = field.default;
    return acc;
  }, {});

const baseWorkflows = workflowsData.workflows as readonly WorkflowConfigBase[];

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

export const defaultWorkflowSettings: WorkflowSettingsMap = {
  compress: buildDefaults(compressSettingsSchema) as WorkflowSettingsMap["compress"],
  convert: buildDefaults(convertSettingsSchema) as WorkflowSettingsMap["convert"],
  remove_bg: buildDefaults(removeBgSettingsSchema) as WorkflowSettingsMap["remove_bg"],
  blur_text: buildDefaults(blurTextSettingsSchema) as WorkflowSettingsMap["blur_text"],
};

export const getWorkflow = (workflow: Workflow) => workflows[workflow];

export const convertFormatExtension = (format: ConvertOutputFormat) =>
  format === "jpeg" ? "jpg" : format;
