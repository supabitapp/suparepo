import type { CompressionErrorCode, CompressionTaskError } from "./types";

const knownErrorCodes: CompressionErrorCode[] = [
  "unsupported_format",
  "decode_failed",
  "encode_failed",
  "task_failed",
  "io_error",
  "unknown",
];

const errorLabels: Record<CompressionErrorCode, string> = {
  unsupported_format: "Unsupported format",
  decode_failed: "Decode failed",
  encode_failed: "Encode failed",
  task_failed: "Task failed",
  io_error: "File error",
  unknown: "Failed",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeCode = (value: string): CompressionErrorCode => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

  return knownErrorCodes.includes(normalized as CompressionErrorCode)
    ? (normalized as CompressionErrorCode)
    : "unknown";
};

const readMessage = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  if (typeof value.message === "string") return value.message;
  if (typeof value.error === "string") return value.error;
  return undefined;
};

export const normalizeCompressionError = (value: unknown): CompressionTaskError => {
  if (value instanceof Error) {
    return normalizeCompressionError(value.message);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return normalizeCompressionError(JSON.parse(trimmed));
      } catch {
        return { code: "unknown", message: trimmed || undefined };
      }
    }
    return { code: "unknown", message: trimmed || undefined };
  }

  if (isRecord(value)) {
    const typeValue = value.type ?? value.code ?? value.kind;
    const message = readMessage(value);
    if (typeof typeValue === "string") {
      return { code: normalizeCode(typeValue), message };
    }
    if (message) {
      return { code: "unknown", message };
    }
  }

  return { code: "unknown" };
};

export const compressionErrorLabel = (error?: CompressionTaskError) =>
  error ? errorLabels[error.code] : errorLabels.unknown;

export const compressionErrorMessage = (error?: CompressionTaskError) => {
  if (!error) return undefined;
  const label = compressionErrorLabel(error);
  return error.message ? `${label}: ${error.message}` : label;
};
