import { fileNameFromPath } from "@/lib/file-utils";
import { createDefaultSettings } from "@/lib/settings";
import { type FileItem, type Platform, useStore } from "@/store";

export const resetStore = (platform: Platform = "unknown") => {
  useStore.setState({
    filesById: {},
    fileOrder: [],
    settings: createDefaultSettings(),
    platform,
    cachedUpdateVersion: null,
    installingUpdateVersion: null,
  });
};

type FileInput = Pick<FileItem, "id" | "path" | "status" | "originalSize" | "workflow"> &
  Partial<Omit<FileItem, "id" | "path" | "status" | "originalSize" | "workflow" | "name">> & {
    name?: string;
  };

export const makeFile = (input: FileInput): FileItem => ({
  id: input.id,
  path: input.path,
  name: input.name ?? fileNameFromPath(input.path),
  workflow: input.workflow,
  originalSize: input.originalSize,
  status: input.status,
  outputSize: input.outputSize,
  progress: input.progress,
  error: input.error,
  hasOutputCopy: input.hasOutputCopy,
});
