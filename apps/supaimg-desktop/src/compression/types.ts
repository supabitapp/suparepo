export type CompressionErrorCode =
  | "unsupported_format"
  | "decode_failed"
  | "encode_failed"
  | "task_failed"
  | "io_error"
  | "unknown";

export type CompressionTaskError = {
  code: CompressionErrorCode;
  message?: string;
};

export interface ImageResult {
  original_size: number;
  output_size: number;
  format: string;
}

export interface ImageProgressEvent {
  fileId: string;
  progress: number;
}
