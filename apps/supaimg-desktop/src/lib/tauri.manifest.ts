export const COMMANDS = [
  "process_file",
  "count_drag_items",
  "expand_paths",
  "get_platform",
  "reveal_in_finder",
  "set_menu_bar_icon_visible",
  "set_titlebar_color",
  "set_posthog_enabled",
  "prepare_remove_bg_models",
  "prepare_blur_text_models",
  "download_update_to_cache",
  "install_cached_update",
  "get_cached_update_version",
  "clear_update_cache",
] as const;

export const EVENTS = [
  "image-progress",
  "model-download-progress",
  "text-model-download-progress",
  "update-download-progress",
  "tauri://drag-enter",
  "tauri://drag-leave",
  "tauri://drag-drop",
] as const;
