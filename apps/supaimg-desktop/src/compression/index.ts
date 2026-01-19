import { COMMANDS, EVENTS, invokeCommand, listenEvent } from "@/lib/tauri";
import type {
  BlurMode,
  ConvertOutputFormat,
  RemoveBgOutputFormat,
  Workflow,
} from "@/lib/workflows";
import {
  compressionErrorLabel,
  compressionErrorMessage,
  normalizeCompressionError,
} from "./errors";
import type { ImageProgressEvent, ImageResult } from "./types";

export function detectConcurrency(): number {
  if (typeof navigator === "undefined") return 1;
  const cores = Math.floor(navigator.hardwareConcurrency ?? 2);
  return Math.max(1, Math.min(cores, 4));
}

export type ProcessOptionsByWorkflow = {
  compress: {
    overrideOriginal: boolean;
    stripPngMetadata: boolean;
    stripJpegMetadata: boolean;
  };
  convert: {
    outputFormat: ConvertOutputFormat;
    jpegQuality: number;
    pngCompressionLevel: number;
    webpQuality: number;
    webpLossless: boolean;
    gifColors: number;
  };
  remove_bg: {
    outputFormat: RemoveBgOutputFormat;
  };
  blur_text: {
    overrideOriginal: boolean;
    blurMode: BlurMode;
    blurStrength: number;
    padding: number;
    confidenceThreshold: number;
    minBoxSize: number;
  };
};

export type ProcessOptions<W extends Workflow = Workflow> = ProcessOptionsByWorkflow[W];

export async function processWorkflowPath<W extends Workflow>(
  fileId: string,
  path: string,
  workflow: W,
  options: ProcessOptions<W>,
): Promise<ImageResult> {
  return await invokeCommand<ImageResult>(COMMANDS.processFile, {
    fileId,
    path,
    workflow,
    options,
  });
}

export function setupCompressionProgressListener(handler: (event: ImageProgressEvent) => void) {
  const unlistenImage = listenEvent<ImageProgressEvent>(EVENTS.imageProgress, (event) =>
    handler(event),
  );
  return unlistenImage.then((unlisten) => () => {
    unlisten();
  });
}

export type { CompressionTaskError, ImageProgressEvent, ImageResult } from "./types";

export { compressionErrorLabel, compressionErrorMessage, normalizeCompressionError };
