export const tauriCommands = ["process_file","count_drag_items","expand_paths","get_platform","set_posthog_enabled","set_menu_bar_icon_visible","reveal_in_finder","set_titlebar_color","prepare_remove_bg_models","prepare_blur_text_models","download_update_to_cache","install_cached_update","get_cached_update_version","clear_update_cache"] as const;
export const tauriEvents = ["image-progress","model-download-progress","text-model-download-progress","update-download-progress"] as const;
export type TauriCommand = (typeof tauriCommands)[number];
export type TauriEvent = (typeof tauriEvents)[number];
