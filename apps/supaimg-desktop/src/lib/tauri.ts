import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";

export const COMMANDS = {
  processFile: "process_file",
  countDragItems: "count_drag_items",
  expandPaths: "expand_paths",
  getPlatform: "get_platform",
  revealInFinder: "reveal_in_finder",
  setMenuBarIconVisible: "set_menu_bar_icon_visible",
  setTitlebarColor: "set_titlebar_color",
  setPosthogEnabled: "set_posthog_enabled",
  prepareRemoveBgModels: "prepare_remove_bg_models",
  prepareBlurTextModels: "prepare_blur_text_models",
  downloadUpdateToCache: "download_update_to_cache",
  installCachedUpdate: "install_cached_update",
  getCachedUpdateVersion: "get_cached_update_version",
  clearUpdateCache: "clear_update_cache",
} as const;

export const EVENTS = {
  imageProgress: "image-progress",
  modelDownloadProgress: "model-download-progress",
  textModelDownloadProgress: "text-model-download-progress",
  updateDownloadProgress: "update-download-progress",
  dragEnter: "tauri://drag-enter",
  dragLeave: "tauri://drag-leave",
  dragDrop: "tauri://drag-drop",
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export const isTauri = () =>
  typeof window !== "undefined" &&
  typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke ===
    "function";

export const invokeCommand = <T>(command: CommandName, payload?: Record<string, unknown>) =>
  payload ? invoke<T>(command, payload) : invoke<T>(command);

export const listenEvent = <T>(event: EventName, handler: (payload: T) => void) =>
  listen<T>(event, (evt) => handler(evt.payload));

export const autostart = {
  enable: enableAutostart,
  disable: disableAutostart,
  isEnabled: isAutostartEnabled,
};
