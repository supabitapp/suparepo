import { error as logError } from "@tauri-apps/plugin-log";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CompressionTaskError,
  normalizeCompressionError,
  type ProcessOptionsByWorkflow,
  processWorkflowPath,
  setupCompressionProgressListener,
} from "@/compression";
import { createTaskScheduler } from "@/compression/queue";
import { skipProcessingReason } from "@/lib/file-utils";
import { setPosthogEnabled as setPosthogClientEnabled } from "@/lib/posthog";
import {
  createDefaultSettings,
  createSettingsStorage,
  mergeSettings,
  migratePersistedState,
  type PersistedSettingsState,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  type SettingsState,
} from "@/lib/settings";
import { autostart, COMMANDS, invokeCommand, isTauri } from "@/lib/tauri";
import {
  type ConvertOutputFormat,
  getWorkflow,
  type Workflow,
  type WorkflowSettingsMap,
} from "@/lib/workflows";

const setMenuBarIconVisibility = (visible: boolean) => {
  if (!isTauri()) return;
  void invokeCommand(COMMANDS.setMenuBarIconVisible, { visible }).catch((err) => {
    void logError(`[tray] visibility failed: ${String(err)}`);
  });
};

const setPosthogEnabled = (enabled: boolean) => {
  setPosthogClientEnabled(enabled);
  if (!isTauri()) return;
  void invokeCommand(COMMANDS.setPosthogEnabled, { enabled }).catch((err) => {
    void logError(`[posthog] toggle failed: ${String(err)}`);
  });
};

export type FileStatus = "pending" | "processing" | "done" | "error" | "skipped";

export interface FileItem {
  id: string;
  path: string;
  name: string;
  workflow: Workflow;
  originalSize: number;
  outputSize?: number;
  status: FileStatus;
  progress?: number;
  error?: CompressionTaskError;
  skipReason?: string;
  hasOutputCopy?: boolean;
  outputFormat?: ConvertOutputFormat;
  convertOptions?: ProcessOptionsByWorkflow["convert"];
}

export type Platform = "windows" | "macos" | "linux" | "unknown";

interface AppState {
  filesById: Record<string, FileItem>;
  fileOrder: string[];
  settings: SettingsState;
  platform: Platform;
  cachedUpdateVersion: string | null;
  installingUpdateVersion: string | null;

  addFiles: (workflow: Workflow, paths: string[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  clearAll: (workflow: Workflow) => void;
  setWorkflowSetting: <W extends Workflow, K extends keyof WorkflowSettingsMap[W]>(
    workflow: W,
    key: K,
    value: WorkflowSettingsMap[W][K],
  ) => void;
  setLaunchAtLogin: (launchAtLogin: boolean) => Promise<void>;
  setShowMenuBarIcon: (showMenuBarIcon: boolean) => void;
  compressFile: (id: string) => Promise<void>;
  setAutoUpdate: (autoUpdate: boolean) => void;
  setAnalyticsTracking: (analyticsTracking: boolean) => void;
  setCachedUpdateVersion: (version: string | null) => void;
  setInstallingUpdateVersion: (version: string | null) => void;
}

const updateFileById = (state: AppState, id: string, updater: (file: FileItem) => FileItem) => {
  const file = state.filesById[id];
  if (!file) return state;
  return {
    ...state,
    filesById: {
      ...state.filesById,
      [id]: updater(file),
    },
  };
};

export const selectWorkflowFiles = (
  fileOrder: string[],
  filesById: Record<string, FileItem>,
  workflow: Workflow,
) =>
  fileOrder
    .map((id) => filesById[id])
    .filter((file): file is FileItem => Boolean(file && file.workflow === workflow));

export const selectWorkflowFileCount = (
  state: Pick<AppState, "fileOrder" | "filesById">,
  workflow: Workflow,
) =>
  state.fileOrder.reduce((count, id) => {
    const file = state.filesById[id];
    return file && file.workflow === workflow ? count + 1 : count;
  }, 0);

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const hasWindow = typeof window !== "undefined";

      const syncLaunchAtLogin = () => {
        if (!isTauri()) return;
        void autostart
          .isEnabled()
          .then((enabled) => {
            set((state) => ({
              settings: { ...state.settings, launchAtLogin: enabled },
            }));
          })
          .catch((err) => {
            void logError(`[autostart] status failed: ${String(err)}`);
          });
      };

      if (hasWindow) {
        void setupCompressionProgressListener((event) => {
          set((state) =>
            updateFileById(state, event.fileId, (file) => ({
              ...file,
              progress: Math.max(0, Math.min(1, event.progress)),
            })),
          );
        });

        if (isTauri()) {
          void invokeCommand<string>(COMMANDS.getPlatform)
            .then((value) => {
              const normalized =
                value === "windows" || value === "linux" || value === "macos" ? value : "unknown";
              set({ platform: normalized });
            })
            .catch((err) => {
              void logError(`[platform] invoke failed: ${String(err)}`);
            });
          syncLaunchAtLogin();
        }
      }

      const scheduler = createTaskScheduler({
        getTask: (id) => {
          const file = get().filesById[id];
          if (!file || file.status !== "pending") return null;
          return { id: file.id, path: file.path, workflow: file.workflow };
        },
        runTask: async (task) => {
          const config = getWorkflow(task.workflow);
          const file = get().filesById[task.id];
          const { options, overrideOriginal, outputFormat } = (() => {
            switch (task.workflow) {
              case "compress": {
                const settings = get().settings.workflowSettings.compress;
                const overrideOriginal = settings.overrideOriginal;
                return {
                  options: {
                    overrideOriginal,
                    stripPngMetadata: settings.stripPngMetadata,
                    stripJpegMetadata: settings.stripJpegMetadata,
                  },
                  overrideOriginal,
                };
              }
              case "convert": {
                const settings = get().settings.workflowSettings.convert;
                const convertOptions = file?.convertOptions ?? {
                  outputFormat: settings.outputFormat,
                  jpegQuality: settings.jpegQuality,
                  pngCompressionLevel: settings.pngCompressionLevel,
                  webpQuality: settings.webpQuality,
                  webpLossless: settings.webpLossless,
                  gifColors: settings.gifColors,
                };
                return {
                  options: convertOptions,
                  overrideOriginal: false,
                  outputFormat: convertOptions.outputFormat,
                };
              }
              case "remove_bg": {
                const settings = get().settings.workflowSettings.remove_bg;
                return {
                  options: { outputFormat: settings.outputFormat },
                  overrideOriginal: false,
                  outputFormat: settings.outputFormat,
                };
              }
              case "blur_text": {
                const settings = get().settings.workflowSettings.blur_text;
                return {
                  options: {
                    overrideOriginal: settings.overrideOriginal,
                    blurMode: settings.blurMode,
                    blurStrength: settings.blurStrength,
                    padding: settings.padding,
                    confidenceThreshold: settings.confidenceThreshold,
                    minBoxSize: settings.minBoxSize,
                  },
                  overrideOriginal: settings.overrideOriginal,
                  outputFormat: undefined,
                };
              }
            }
          })();
          const result = await processWorkflowPath(task.id, task.path, task.workflow, options);
          return {
            result,
            hasOutputCopy: config.outputBehavior === "allow_override" ? !overrideOriginal : true,
            outputFormat,
          };
        },
        onStart: (id) => {
          set((state) =>
            updateFileById(state, id, (file) => ({
              ...file,
              status: "processing" as const,
              progress: 0,
              error: undefined,
            })),
          );
        },
        onSuccess: (id, { result, hasOutputCopy, outputFormat }) => {
          set((state) =>
            updateFileById(state, id, (file) => ({
              ...file,
              status: "done" as const,
              originalSize: result.original_size,
              outputSize: result.output_size,
              progress: 1,
              hasOutputCopy,
              outputFormat,
              error: undefined,
            })),
          );
        },
        onError: (id, err) => {
          void logError(`[process] invoke failed: ${String(err)}`);
          set((state) =>
            updateFileById(state, id, (file) => ({
              ...file,
              status: "error" as const,
              error: normalizeCompressionError(err),
              progress: undefined,
            })),
          );
        },
      });

      return {
        filesById: {},
        fileOrder: [],
        settings: createDefaultSettings(),
        platform: "unknown",
        cachedUpdateVersion: null,
        installingUpdateVersion: null,

        addFiles: (workflow, paths) => {
          const convertOutputFormat =
            workflow === "convert"
              ? get().settings.workflowSettings.convert.outputFormat
              : undefined;
          const convertSettings =
            workflow === "convert" ? get().settings.workflowSettings.convert : null;
          const existingPaths = new Set(
            Object.values(get().filesById)
              .filter((file) => file.workflow === workflow)
              .map((file) =>
                file.outputFormat ? `${file.path}::${file.outputFormat}` : file.path,
              ),
          );
          const seenPaths = new Set<string>();
          const uniquePaths = paths.filter((path) => {
            const key = convertOutputFormat ? `${path}::${convertOutputFormat}` : path;
            if (existingPaths.has(key) || seenPaths.has(key)) {
              return false;
            }
            seenPaths.add(key);
            return true;
          });

          if (uniquePaths.length === 0) {
            return;
          }

          const newFiles: FileItem[] = uniquePaths.map((path) => {
            const convertOptions =
              workflow === "convert"
                ? {
                    outputFormat: convertSettings?.outputFormat ?? "jpeg",
                    jpegQuality: convertSettings?.jpegQuality ?? 100,
                    pngCompressionLevel: convertSettings?.pngCompressionLevel ?? 6,
                    webpQuality: convertSettings?.webpQuality ?? 100,
                    webpLossless: convertSettings?.webpLossless ?? true,
                    gifColors: convertSettings?.gifColors ?? 256,
                  }
                : undefined;
            const skipReason = skipProcessingReason(path, workflow, convertOutputFormat);
            return {
              id: crypto.randomUUID(),
              path,
              name: path.split("/").pop() ?? path,
              workflow,
              originalSize: 0,
              status: skipReason ? "skipped" : "pending",
              skipReason,
              hasOutputCopy: false,
              outputFormat: convertOptions?.outputFormat,
              convertOptions,
            };
          });
          set((state) => {
            const filesById = { ...state.filesById };
            const fileOrder = [...state.fileOrder];
            newFiles.forEach((file) => {
              filesById[file.id] = file;
              fileOrder.push(file.id);
            });
            return { filesById, fileOrder };
          });
          newFiles.forEach((file) => {
            if (file.status !== "skipped") {
              scheduler.enqueueId(file.id);
            }
          });
        },

        removeFile: (id) => {
          set((state) => {
            const { [id]: _, ...filesById } = state.filesById;
            const fileOrder = state.fileOrder.filter((fileId) => fileId !== id);
            return { filesById, fileOrder };
          });
        },

        clearFiles: () => {
          set({ filesById: {}, fileOrder: [] });
        },
        clearAll: (workflow) => {
          set((state) => {
            const fileOrder = state.fileOrder.filter(
              (id) =>
                state.filesById[id]?.workflow !== workflow ||
                state.filesById[id]?.status === "processing",
            );
            const filesById: Record<string, FileItem> = {};
            fileOrder.forEach((id) => {
              const file = state.filesById[id];
              if (file) filesById[id] = file;
            });
            return { filesById, fileOrder };
          });
        },

        setWorkflowSetting: (workflow, key, value) => {
          set((state) => ({
            settings: {
              ...state.settings,
              workflowSettings: {
                ...state.settings.workflowSettings,
                [workflow]: {
                  ...state.settings.workflowSettings[workflow],
                  [key]: value,
                },
              },
            },
          }));
        },
        setLaunchAtLogin: async (launchAtLogin) => {
          if (!isTauri()) {
            set((state) => ({
              settings: { ...state.settings, launchAtLogin },
            }));
            return;
          }
          const action = launchAtLogin ? autostart.enable : autostart.disable;
          try {
            await action();
            const enabled = await autostart.isEnabled();
            set((state) => ({
              settings: { ...state.settings, launchAtLogin: enabled },
            }));
          } catch (err) {
            void logError(`[autostart] update failed: ${String(err)}`);
            try {
              const enabled = await autostart.isEnabled();
              set((state) => ({
                settings: { ...state.settings, launchAtLogin: enabled },
              }));
            } catch (statusErr) {
              void logError(`[autostart] status failed: ${String(statusErr)}`);
            }
          }
        },
        setShowMenuBarIcon: (showMenuBarIcon) => {
          set((state) => ({
            settings: { ...state.settings, showMenuBarIcon },
          }));
          setMenuBarIconVisibility(showMenuBarIcon);
        },
        setAutoUpdate: (autoUpdate) => {
          set((state) => ({
            settings: { ...state.settings, autoUpdate },
          }));
        },
        setAnalyticsTracking: (analyticsTracking) => {
          set((state) => ({
            settings: { ...state.settings, analyticsTracking },
          }));
          setPosthogEnabled(analyticsTracking);
        },

        compressFile: async (id) => scheduler.enqueueId(id),
        setCachedUpdateVersion: (cachedUpdateVersion) => {
          set({ cachedUpdateVersion });
        },
        setInstallingUpdateVersion: (installingUpdateVersion) => {
          set({ installingUpdateVersion });
        },
      };
    },
    {
      name: SETTINGS_STORAGE_KEY,
      version: SETTINGS_VERSION,
      partialize: (state) => ({
        settings: {
          workflowSettings: state.settings.workflowSettings,
          showMenuBarIcon: state.settings.showMenuBarIcon,
          autoUpdate: state.settings.autoUpdate,
          analyticsTracking: state.settings.analyticsTracking,
        },
      }),
      migrate: (persistedState, version) => migratePersistedState(persistedState, version),
      merge: (persistedState, currentState) => {
        const typed = (persistedState ?? {}) as PersistedSettingsState | null;
        return {
          ...currentState,
          ...typed,
          settings: mergeSettings(currentState.settings, typed?.settings),
        };
      },
      storage: createSettingsStorage(),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setMenuBarIconVisibility(state.settings.showMenuBarIcon);
        setPosthogEnabled(state.settings.analyticsTracking);
      },
    },
  ),
);
