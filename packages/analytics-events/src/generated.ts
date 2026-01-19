export const events = {
  "events": [
    {
      "name": "workflow_error",
      "payload": {
        "workflow": "string",
        "elapsed_ms": "number",
        "build": "string",
        "override_original": "boolean",
        "strip_png_metadata": "boolean",
        "strip_jpeg_metadata": "boolean",
        "output_format": "string",
        "jpeg_quality": "number",
        "png_compression_level": "number",
        "webp_quality": "number",
        "webp_lossless": "boolean",
        "gif_colors": "number",
        "blur_mode": "string",
        "blur_strength": "number",
        "padding": "number",
        "confidence_threshold": "number",
        "min_box_size": "number",
        "error_kind": "string"
      }
    },
    {
      "name": "workflow_failure",
      "payload": {
        "workflow": "string",
        "elapsed_ms": "number",
        "build": "string",
        "override_original": "boolean",
        "strip_png_metadata": "boolean",
        "strip_jpeg_metadata": "boolean",
        "output_format": "string",
        "jpeg_quality": "number",
        "png_compression_level": "number",
        "webp_quality": "number",
        "webp_lossless": "boolean",
        "gif_colors": "number",
        "blur_mode": "string",
        "blur_strength": "number",
        "padding": "number",
        "confidence_threshold": "number",
        "min_box_size": "number",
        "failure_kind": "string"
      }
    },
    {
      "name": "workflow_success",
      "payload": {
        "workflow": "string",
        "elapsed_ms": "number",
        "build": "string",
        "override_original": "boolean",
        "strip_png_metadata": "boolean",
        "strip_jpeg_metadata": "boolean",
        "output_format": "string",
        "jpeg_quality": "number",
        "png_compression_level": "number",
        "webp_quality": "number",
        "webp_lossless": "boolean",
        "gif_colors": "number",
        "blur_mode": "string",
        "blur_strength": "number",
        "padding": "number",
        "confidence_threshold": "number",
        "min_box_size": "number",
        "input_size_bytes": "number",
        "output_size_bytes": "number",
        "format": "string"
      }
    }
  ]
} as const;

const optionalPayloadFields = {
  "workflow_error": [
    "override_original",
    "strip_png_metadata",
    "strip_jpeg_metadata",
    "output_format",
    "jpeg_quality",
    "png_compression_level",
    "webp_quality",
    "webp_lossless",
    "gif_colors",
    "blur_mode",
    "blur_strength",
    "padding",
    "confidence_threshold",
    "min_box_size"
  ],
  "workflow_failure": [
    "override_original",
    "strip_png_metadata",
    "strip_jpeg_metadata",
    "output_format",
    "jpeg_quality",
    "png_compression_level",
    "webp_quality",
    "webp_lossless",
    "gif_colors",
    "blur_mode",
    "blur_strength",
    "padding",
    "confidence_threshold",
    "min_box_size"
  ],
  "workflow_success": [
    "override_original",
    "strip_png_metadata",
    "strip_jpeg_metadata",
    "output_format",
    "jpeg_quality",
    "png_compression_level",
    "webp_quality",
    "webp_lossless",
    "gif_colors",
    "blur_mode",
    "blur_strength",
    "padding",
    "confidence_threshold",
    "min_box_size"
  ]
} as const;

type OptionalPayloadFieldMap = typeof optionalPayloadFields;

type PayloadTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  "string[]": string[];
  "number[]": number[];
  "boolean[]": boolean[];
};

export type AnalyticsEventName = (typeof events.events)[number]["name"];

type PayloadSchema<E extends AnalyticsEventName> = Extract<
  (typeof events.events)[number],
  { name: E }
>["payload"];

type PayloadFieldType<T> = T extends keyof PayloadTypeMap
  ? PayloadTypeMap[T]
  : never;

type OptionalFields<E extends AnalyticsEventName> = E extends keyof OptionalPayloadFieldMap
  ? OptionalPayloadFieldMap[E][number]
  : never;

type RequiredFields<E extends AnalyticsEventName> = Exclude<
  keyof PayloadSchema<E>,
  OptionalFields<E>
>;

export type AnalyticsEventPayload<E extends AnalyticsEventName> = {
  [K in RequiredFields<E>]: PayloadFieldType<PayloadSchema<E>[K]>;
} & {
  [K in OptionalFields<E>]?: PayloadFieldType<PayloadSchema<E>[K]>;
};

