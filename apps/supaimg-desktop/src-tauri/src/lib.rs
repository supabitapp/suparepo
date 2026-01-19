// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod background_removal;
pub mod compression;
mod conversion;
mod image_utils;
mod model_download;
pub mod onnx_runtime;
pub mod text_blur;
mod workflow;

use compression::{CompressionError, CompressionOptions, ImageFormat, ImageResult};
use conversion::{ConvertOptions, ConvertOutputFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock};
use std::time::Instant;
#[cfg(desktop)]
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
#[cfg(desktop)]
use tauri::Manager;
use tauri::State;
use tauri_plugin_better_posthog::{PostHogEvent, PostHogExt};
use tauri_plugin_log::log;
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;
use workflow::{
    is_supported_extension, output_path as workflow_output_path, output_path_with_extension,
    workflow_config, Workflow, WorkflowTask,
};

#[cfg(desktop)]
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/32x32.png");

struct PostHogControl {
    enabled: Arc<AtomicBool>,
}

struct WorkflowErrorEvent {
    properties: HashMap<String, serde_json::Value>,
}

impl PostHogEvent for WorkflowErrorEvent {
    fn name(&self) -> &str {
        "workflow_error"
    }

    fn properties(&self) -> HashMap<String, serde_json::Value> {
        self.properties.clone()
    }
}

struct WorkflowFailureEvent {
    properties: HashMap<String, serde_json::Value>,
}

impl PostHogEvent for WorkflowFailureEvent {
    fn name(&self) -> &str {
        "workflow_failure"
    }

    fn properties(&self) -> HashMap<String, serde_json::Value> {
        self.properties.clone()
    }
}

struct WorkflowSuccessEvent {
    properties: HashMap<String, serde_json::Value>,
}

impl PostHogEvent for WorkflowSuccessEvent {
    fn name(&self) -> &str {
        "workflow_success"
    }

    fn properties(&self) -> HashMap<String, serde_json::Value> {
        self.properties.clone()
    }
}

fn workflow_label(workflow: Workflow) -> &'static str {
    match workflow {
        Workflow::Compress => "compress",
        Workflow::Convert => "convert",
        Workflow::RemoveBg => "remove_bg",
        Workflow::BlurText => "blur_text",
    }
}

fn build_label() -> &'static str {
    if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    }
}

fn error_kind(err: &CompressionError) -> &'static str {
    match err {
        CompressionError::UnsupportedFormat => "unsupported_format",
        CompressionError::DecodeFailed(_) => "decode_failed",
        CompressionError::EncodeFailed(_) => "encode_failed",
        CompressionError::TaskFailed(_) => "task_failed",
        CompressionError::IoError(_) => "io_error",
    }
}

fn failure_kind(err: &tauri::Error) -> &'static str {
    match err {
        tauri::Error::JoinError(_) => "join_error",
        _ => "unknown",
    }
}

fn convert_output_label(format: &ConvertOutputFormat) -> &'static str {
    match format {
        ConvertOutputFormat::Jpeg => "jpeg",
        ConvertOutputFormat::Png => "png",
        ConvertOutputFormat::Webp => "webp",
        ConvertOutputFormat::Gif => "gif",
    }
}

fn remove_bg_output_label(format: &RemoveBgOutputFormat) -> &'static str {
    match format {
        RemoveBgOutputFormat::Png => "png",
        RemoveBgOutputFormat::Webp => "webp",
    }
}

fn blur_mode_label(mode: &BlurMode) -> &'static str {
    match mode {
        BlurMode::Gaussian => "gaussian",
        BlurMode::Pixelate => "pixelate",
        BlurMode::Solid => "solid",
    }
}

fn workflow_properties(
    workflow: Workflow,
    options: &ProcessOptions,
    elapsed_ms: u128,
) -> HashMap<String, serde_json::Value> {
    let mut properties = HashMap::new();
    properties.insert("workflow".to_string(), workflow_label(workflow).into());
    properties.insert("elapsed_ms".to_string(), (elapsed_ms as u64).into());
    properties.insert("build".to_string(), build_label().into());
    match options {
        ProcessOptions::Compress(options) => {
            properties.insert(
                "override_original".to_string(),
                options.override_original.into(),
            );
            properties.insert(
                "strip_png_metadata".to_string(),
                options.strip_png_metadata.into(),
            );
            properties.insert(
                "strip_jpeg_metadata".to_string(),
                options.strip_jpeg_metadata.into(),
            );
        }
        ProcessOptions::Convert(options) => {
            properties.insert(
                "output_format".to_string(),
                convert_output_label(&options.output_format).into(),
            );
            properties.insert("jpeg_quality".to_string(), options.jpeg_quality.into());
            properties.insert(
                "png_compression_level".to_string(),
                options.png_compression_level.into(),
            );
            properties.insert("webp_quality".to_string(), options.webp_quality.into());
            properties.insert("webp_lossless".to_string(), options.webp_lossless.into());
            properties.insert("gif_colors".to_string(), options.gif_colors.into());
        }
        ProcessOptions::RemoveBg(options) => {
            properties.insert(
                "output_format".to_string(),
                remove_bg_output_label(&options.output_format).into(),
            );
        }
        ProcessOptions::BlurText(options) => {
            properties.insert(
                "override_original".to_string(),
                options.override_original.into(),
            );
            properties.insert(
                "blur_mode".to_string(),
                blur_mode_label(&options.blur_mode).into(),
            );
            properties.insert("blur_strength".to_string(), options.blur_strength.into());
            properties.insert("padding".to_string(), options.padding.into());
            properties.insert(
                "confidence_threshold".to_string(),
                options.confidence_threshold.into(),
            );
            properties.insert("min_box_size".to_string(), options.min_box_size.into());
        }
    }
    properties
}

fn report_task_error(
    app: &tauri::AppHandle,
    workflow: Workflow,
    options: &ProcessOptions,
    elapsed_ms: u128,
    err: &CompressionError,
) {
    let mut properties = workflow_properties(workflow, options, elapsed_ms);
    properties.insert("error_kind".to_string(), error_kind(err).into());
    app.capture_event(WorkflowErrorEvent { properties });
}

fn report_task_failure(
    app: &tauri::AppHandle,
    workflow: Workflow,
    options: &ProcessOptions,
    elapsed_ms: u128,
    err: &tauri::Error,
) {
    let mut properties = workflow_properties(workflow, options, elapsed_ms);
    properties.insert("failure_kind".to_string(), failure_kind(err).into());
    app.capture_event(WorkflowFailureEvent { properties });
}

fn format_label(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Jpeg => "jpeg",
        ImageFormat::Png => "png",
        ImageFormat::Gif => "gif",
        ImageFormat::WebP => "webp",
    }
}

fn report_task_success(
    app: &tauri::AppHandle,
    workflow: Workflow,
    options: &ProcessOptions,
    elapsed_ms: u128,
    result: &ImageResult,
) {
    let mut properties = workflow_properties(workflow, options, elapsed_ms);
    properties.insert(
        "input_size_bytes".to_string(),
        (result.original_size as u64).into(),
    );
    properties.insert(
        "output_size_bytes".to_string(),
        (result.output_size as u64).into(),
    );
    properties.insert("format".to_string(), format_label(result.format).into());
    app.capture_event(WorkflowSuccessEvent { properties });
}

fn convert_output_extension(format: &ConvertOutputFormat) -> &'static str {
    match format {
        ConvertOutputFormat::Jpeg => "jpg",
        ConvertOutputFormat::Png => "png",
        ConvertOutputFormat::Webp => "webp",
        ConvertOutputFormat::Gif => "gif",
    }
}

#[cfg(target_os = "macos")]
fn set_window_bg_color(ns_window: *mut std::ffi::c_void, r: u8, g: u8, b: u8) {
    use objc2::rc::Retained;
    use objc2_app_kit::{NSColor, NSWindow};

    let window: Retained<NSWindow> =
        unsafe { Retained::retain(ns_window as *mut NSWindow) }.unwrap();
    let color = NSColor::colorWithRed_green_blue_alpha(
        r as f64 / 255.0,
        g as f64 / 255.0,
        b as f64 / 255.0,
        1.0,
    );
    window.setBackgroundColor(Some(&color));
}

#[cfg(target_os = "macos")]
fn set_window_level_floating(ns_window: *mut std::ffi::c_void) {
    use objc2::rc::Retained;
    use objc2_app_kit::{NSFloatingWindowLevel, NSWindow};

    let window: Retained<NSWindow> =
        unsafe { Retained::retain(ns_window as *mut NSWindow) }.unwrap();
    window.setLevel(NSFloatingWindowLevel);
}

#[tauri::command]
fn set_titlebar_color(_window: tauri::Window, _r: u8, _g: u8, _b: u8) {
    #[cfg(target_os = "macos")]
    set_window_bg_color(_window.ns_window().unwrap(), _r, _g, _b);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DragCounts {
    file_count: usize,
    folder_count: usize,
    skipped_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CachedUpdate {
    version: String,
    current_version: String,
}

fn update_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_cache_dir().map_err(|err| err.to_string())
}

fn parse_cached_version(file_name: &str) -> Option<String> {
    let prefix = "update-";
    let suffix = ".bin";
    if !file_name.starts_with(prefix) || !file_name.ends_with(suffix) {
        return None;
    }
    let version = &file_name[prefix.len()..file_name.len() - suffix.len()];
    if version.is_empty() {
        None
    } else {
        Some(version.to_string())
    }
}

fn cached_update_versions(dir: &Path) -> Result<Vec<String>, String> {
    let mut versions = Vec::new();
    if !dir.exists() {
        return Ok(versions);
    }
    let entries = fs::read_dir(dir).map_err(|err| err.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if let Some(version) = parse_cached_version(file_name) {
            versions.push(version);
        }
    }
    Ok(versions)
}

fn clear_update_cache_inner(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|err| err.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if parse_cached_version(file_name).is_some() {
            fs::remove_file(&path).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn set_posthog_enabled(state: State<PostHogControl>, enabled: bool) {
    state.enabled.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
async fn download_update_to_cache(app: tauri::AppHandle) -> Result<Option<CachedUpdate>, String> {
    #[cfg(not(desktop))]
    {
        let _ = app;
        return Ok(None);
    }
    #[cfg(desktop)]
    {
        if cfg!(debug_assertions) {
            return Ok(None);
        }
        let updater = app.updater().map_err(|err| err.to_string())?;
        let update = updater.check().await.map_err(|err| err.to_string())?;
        let Some(update) = update else {
            return Ok(None);
        };
        let cache_dir = update_cache_dir(&app)?;
        fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
        clear_update_cache_inner(&cache_dir)?;
        let _ = app.emit(
            "update-download-progress",
            UpdateDownloadProgressEvent { progress: 0.0 },
        );
        let mut downloaded = 0u64;
        let mut total_bytes: Option<u64> = None;
        let app_handle = app.clone();
        let app_handle_finish = app.clone();
        let bytes = update
            .download(
                move |chunk_length, content_length| {
                    downloaded = downloaded.saturating_add(chunk_length as u64);
                    if total_bytes.is_none() {
                        total_bytes = content_length;
                    }
                    if let Some(total) = total_bytes {
                        if total > 0 {
                            let progress = (downloaded as f64 / total as f64).min(1.0);
                            let _ = app_handle.emit(
                                "update-download-progress",
                                UpdateDownloadProgressEvent { progress },
                            );
                        }
                    }
                },
                move || {
                    let _ = app_handle_finish.emit(
                        "update-download-progress",
                        UpdateDownloadProgressEvent { progress: 1.0 },
                    );
                },
            )
            .await
            .map_err(|err| {
                let _ = app.emit(
                    "update-download-progress",
                    UpdateDownloadProgressEvent { progress: 1.0 },
                );
                err.to_string()
            })?;
        let version = update.version.clone();
        let current_version = update.current_version.clone();
        let path = cache_dir.join(format!("update-{}.bin", version));
        let mut temp = tempfile::Builder::new()
            .prefix("update-")
            .suffix(".tmp")
            .tempfile_in(&cache_dir)
            .map_err(|err| err.to_string())?;
        temp.write_all(&bytes).map_err(|err| err.to_string())?;
        temp.flush().map_err(|err| err.to_string())?;
        temp.persist(&path).map_err(|err| err.error.to_string())?;
        Ok(Some(CachedUpdate {
            version,
            current_version,
        }))
    }
}

#[tauri::command]
async fn install_cached_update(app: tauri::AppHandle, version: String) -> Result<(), String> {
    #[cfg(not(desktop))]
    {
        let _ = app;
        let _ = version;
        return Ok(());
    }
    #[cfg(desktop)]
    {
        if cfg!(debug_assertions) {
            return Ok(());
        }
        let cache_dir = update_cache_dir(&app)?;
        let path = cache_dir.join(format!("update-{}.bin", version));
        let bytes = fs::read(&path).map_err(|err| err.to_string())?;
        let updater = app.updater().map_err(|err| err.to_string())?;
        let update = updater.check().await.map_err(|err| err.to_string())?;
        let Some(update) = update else {
            clear_update_cache_inner(&cache_dir)?;
            return Err("update not available".to_string());
        };
        if update.version != version {
            clear_update_cache_inner(&cache_dir)?;
            return Err("cached update version mismatch".to_string());
        }
        let _ = fs::remove_file(&path);
        update.install(&bytes).map_err(|err| err.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn get_cached_update_version(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let cache_dir = update_cache_dir(&app)?;
    let mut versions = cached_update_versions(&cache_dir)?;
    Ok(versions.pop())
}

#[tauri::command]
fn clear_update_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = update_cache_dir(&app)?;
    clear_update_cache_inner(&cache_dir)
}

fn collect_files_depth_one(dir: &Path, out: &mut Vec<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) => {
            log::warn!(
                "drag-drop read_dir failed path=\"{}\" err={}",
                dir.display(),
                err
            );
            return;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                log::warn!(
                    "drag-drop read_dir entry failed path=\"{}\" err={}",
                    dir.display(),
                    err
                );
                continue;
            }
        };
        let entry_path = entry.path();
        let entry_type = match entry.file_type() {
            Ok(entry_type) => entry_type,
            Err(err) => {
                log::warn!(
                    "drag-drop entry type failed path=\"{}\" err={}",
                    entry_path.display(),
                    err
                );
                continue;
            }
        };

        if entry_type.is_file() {
            out.push(entry_path.to_string_lossy().to_string());
            continue;
        }

        if entry_type.is_dir() {
            let nested_entries = match std::fs::read_dir(&entry_path) {
                Ok(entries) => entries,
                Err(err) => {
                    log::warn!(
                        "drag-drop read_dir failed path=\"{}\" err={}",
                        entry_path.display(),
                        err
                    );
                    continue;
                }
            };

            for nested in nested_entries {
                let nested = match nested {
                    Ok(nested) => nested,
                    Err(err) => {
                        log::warn!(
                            "drag-drop read_dir entry failed path=\"{}\" err={}",
                            entry_path.display(),
                            err
                        );
                        continue;
                    }
                };
                let nested_path = nested.path();
                let nested_type = match nested.file_type() {
                    Ok(nested_type) => nested_type,
                    Err(err) => {
                        log::warn!(
                            "drag-drop entry type failed path=\"{}\" err={}",
                            nested_path.display(),
                            err
                        );
                        continue;
                    }
                };
                if nested_type.is_file() {
                    out.push(nested_path.to_string_lossy().to_string());
                }
            }
        }
    }
}

fn should_skip_path(
    path: &Path,
    workflow: Workflow,
    convert_output_format: Option<&ConvertOutputFormat>,
) -> bool {
    let config = workflow_config(workflow);
    if compression::output::is_output_path(path, &config.output_suffix) {
        return true;
    }

    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|value| value.to_lowercase());
    let Some(ext) = ext else {
        return true;
    };

    if !is_supported_extension(&ext, workflow) {
        return true;
    }

    if workflow == Workflow::Convert {
        if let Some(format) = convert_output_format {
            if is_convert_target_extension(&ext, format) {
                return true;
            }
        }
    }

    false
}

fn is_convert_target_extension(ext: &str, format: &ConvertOutputFormat) -> bool {
    match format {
        ConvertOutputFormat::Jpeg => ext == "jpg" || ext == "jpeg",
        ConvertOutputFormat::Png => ext == "png",
        ConvertOutputFormat::Webp => ext == "webp",
        ConvertOutputFormat::Gif => ext == "gif",
    }
}

#[tauri::command]
fn count_drag_items(
    paths: Vec<String>,
    workflow: Workflow,
    convert_output_format: Option<ConvertOutputFormat>,
) -> DragCounts {
    let mut file_count = 0usize;
    let mut folder_count = 0usize;
    let mut skipped_count = 0usize;
    for path in paths {
        let path = Path::new(&path);
        if path.is_file() {
            file_count += 1;
            if should_skip_path(path, workflow, convert_output_format.as_ref()) {
                skipped_count += 1;
            }
        } else if path.is_dir() {
            folder_count += 1;
        } else {
            log::warn!("drag-drop path not found path=\"{}\"", path.display());
        }
    }
    DragCounts {
        file_count,
        folder_count,
        skipped_count,
    }
}

#[tauri::command]
fn expand_paths(paths: Vec<String>) -> Vec<String> {
    let mut output = Vec::new();
    for path in paths {
        let path = Path::new(&path);
        if path.is_file() {
            output.push(path.to_string_lossy().to_string());
        } else if path.is_dir() {
            collect_files_depth_one(path, &mut output);
        } else {
            log::warn!("drag-drop path not found path=\"{}\"", path.display());
        }
    }
    output
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn set_menu_bar_icon_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_visible(visible).map_err(|err| err.to_string())?;
            Ok(())
        } else {
            Err("tray icon not found".to_string())
        }
    }

    #[cfg(not(desktop))]
    {
        let _ = (app, visible);
        Err("tray icon not supported".to_string())
    }
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path is empty".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(trimmed)
            .status()
            .map_err(|err| format!("open -R failed: {err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("open -R failed with status {status}"))
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg("/select,")
            .arg(trimmed.replace('/', "\\"))
            .status()
            .map_err(|err| format!("explorer failed: {err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("explorer failed with status {status}"))
        }
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(
                Path::new(trimmed)
                    .parent()
                    .unwrap_or_else(|| Path::new(trimmed)),
            )
            .status()
            .map_err(|err| format!("xdg-open failed: {err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("xdg-open failed with status {status}"))
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("reveal in finder is not supported on this platform".to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageProgressEvent {
    file_id: String,
    progress: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelDownloadProgressEvent {
    progress: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadProgressEvent {
    progress: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CompressOptions {
    override_original: bool,
    strip_png_metadata: bool,
    strip_jpeg_metadata: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
enum RemoveBgOutputFormat {
    Png,
    Webp,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlurMode {
    Gaussian,
    Pixelate,
    Solid,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RemoveBgOptions {
    output_format: RemoveBgOutputFormat,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BlurTextOptions {
    pub override_original: bool,
    pub blur_mode: BlurMode,
    pub blur_strength: u8,
    pub padding: u8,
    pub confidence_threshold: f32,
    pub min_box_size: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum ProcessOptions {
    Compress(CompressOptions),
    Convert(ConvertOptions),
    RemoveBg(RemoveBgOptions),
    BlurText(BlurTextOptions),
}

#[tauri::command]
async fn process_file(
    app: tauri::AppHandle,
    workflow: Workflow,
    path: String,
    options: ProcessOptions,
    file_id: Option<String>,
) -> Result<ImageResult, CompressionError> {
    let path_for_log = path.clone();
    let file_id_for_log = file_id.clone().unwrap_or_else(|| "unknown".to_string());
    log::info!(
        "process request file_id=\"{}\" workflow=\"{:?}\" path=\"{}\"",
        file_id_for_log,
        workflow,
        path_for_log
    );
    let started = Instant::now();
    let options_for_report = options.clone();
    let app_handle = app.clone();
    let task = tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        log::info!(
            "process start file_id=\"{}\" workflow=\"{:?}\" path=\"{}\"",
            file_id_for_log,
            workflow,
            path
        );
        let config = workflow_config(workflow);
        let output_path = match (&config.task, &options) {
            (WorkflowTask::Compress, ProcessOptions::Compress(options)) => {
                if options.override_original {
                    Path::new(&path).to_path_buf()
                } else {
                    workflow_output_path(Path::new(&path), workflow)
                }
            }
            (WorkflowTask::Convert, ProcessOptions::Convert(options)) => {
                output_path_with_extension(
                    Path::new(&path),
                    workflow,
                    Some(convert_output_extension(&options.output_format)),
                )
            }
            (WorkflowTask::RemoveBg, ProcessOptions::RemoveBg(options)) => {
                match options.output_format {
                    RemoveBgOutputFormat::Webp => {
                        output_path_with_extension(Path::new(&path), workflow, Some("webp"))
                    }
                    RemoveBgOutputFormat::Png => workflow_output_path(Path::new(&path), workflow),
                }
            }
            (WorkflowTask::BlurText, ProcessOptions::BlurText(options)) => {
                if options.override_original {
                    Path::new(&path).to_path_buf()
                } else {
                    workflow_output_path(Path::new(&path), workflow)
                }
            }
            _ => {
                return Err(CompressionError::TaskFailed(
                    "process options did not match workflow".to_string(),
                ))
            }
        };
        let progress_file_id = file_id.clone();
        let app_handle = app_handle.clone();
        let result = match (config.task, options) {
            (WorkflowTask::Compress, ProcessOptions::Compress(options)) => {
                let options = CompressionOptions {
                    strip_png_metadata: options.strip_png_metadata,
                    strip_jpeg_metadata: options.strip_jpeg_metadata,
                    png_compression_level: 2,
                    webp_lossless: true,
                    webp_quality: 75,
                };
                compression::compress_path_with_progress(
                    Path::new(&path),
                    &output_path,
                    options,
                    move |progress| {
                        if let Some(file_id) = progress_file_id.as_ref() {
                            let _ = app_handle.emit(
                                "image-progress",
                                ImageProgressEvent {
                                    file_id: file_id.clone(),
                                    progress,
                                },
                            );
                        }
                    },
                )
            }
            (WorkflowTask::Convert, ProcessOptions::Convert(options)) => {
                let parent = Path::new(&output_path)
                    .parent()
                    .filter(|parent| !parent.as_os_str().is_empty())
                    .unwrap_or_else(|| Path::new("."));
                let temp_output = tempfile::Builder::new()
                    .prefix(".convert_tmp_")
                    .tempfile_in(parent)
                    .map_err(|err| CompressionError::IoError(err.to_string()))?;
                let temp_path = temp_output.path().to_path_buf();
                let png_compression_level = options.png_compression_level;
                let webp_lossless = options.webp_lossless;
                let webp_quality = options.webp_quality;
                let output_format = options.output_format.clone();
                let progress_file_id_for_convert = progress_file_id.clone();
                let app_handle_for_convert = app_handle.clone();
                let convert_result = conversion::convert_path_with_progress(
                    Path::new(&path),
                    &temp_path,
                    options,
                    move |progress| {
                        if let Some(file_id) = progress_file_id_for_convert.as_ref() {
                            let _ = app_handle_for_convert.emit(
                                "image-progress",
                                ImageProgressEvent {
                                    file_id: file_id.clone(),
                                    progress: progress * 0.6,
                                },
                            );
                        }
                    },
                )?;
                if matches!(output_format, ConvertOutputFormat::Webp) {
                    let output_size = fs::metadata(&temp_path)?.len() as usize;
                    fs::copy(&temp_path, &output_path)?;
                    if let Some(file_id) = progress_file_id.as_ref() {
                        let _ = app_handle.emit(
                            "image-progress",
                            ImageProgressEvent {
                                file_id: file_id.clone(),
                                progress: 1.0,
                            },
                        );
                    }
                    return Ok(ImageResult {
                        original_size: convert_result.original_size,
                        output_size,
                        format: convert_result.format,
                    });
                }
                let progress_file_id_for_compress = progress_file_id.clone();
                let app_handle_for_compress = app_handle.clone();
                let compressed = compression::compress_path_with_progress(
                    &temp_path,
                    &output_path,
                    CompressionOptions {
                        strip_png_metadata: true,
                        strip_jpeg_metadata: true,
                        png_compression_level,
                        webp_lossless,
                        webp_quality,
                    },
                    move |progress| {
                        if let Some(file_id) = progress_file_id_for_compress.as_ref() {
                            let _ = app_handle_for_compress.emit(
                                "image-progress",
                                ImageProgressEvent {
                                    file_id: file_id.clone(),
                                    progress: 0.6 + progress * 0.4,
                                },
                            );
                        }
                    },
                )?;
                Ok(ImageResult {
                    original_size: convert_result.original_size,
                    output_size: compressed.output_size,
                    format: compressed.format,
                })
            }
            (WorkflowTask::RemoveBg, ProcessOptions::RemoveBg(options)) => {
                let app_handle_for_progress = app_handle.clone();
                let format = match options.output_format {
                    RemoveBgOutputFormat::Webp => ImageFormat::WebP,
                    RemoveBgOutputFormat::Png => ImageFormat::Png,
                };
                background_removal::remove_background_with_progress(
                    &app_handle,
                    Path::new(&path),
                    &output_path,
                    format,
                    move |progress| {
                        if let Some(file_id) = progress_file_id.as_ref() {
                            let _ = app_handle_for_progress.emit(
                                "image-progress",
                                ImageProgressEvent {
                                    file_id: file_id.clone(),
                                    progress,
                                },
                            );
                        }
                    },
                )
            }
            (WorkflowTask::BlurText, ProcessOptions::BlurText(options)) => {
                let app_handle_for_progress = app_handle.clone();
                text_blur::blur_text_with_progress(
                    &app_handle,
                    Path::new(&path),
                    &output_path,
                    &options,
                    move |progress| {
                        if let Some(file_id) = progress_file_id.as_ref() {
                            let _ = app_handle_for_progress.emit(
                                "image-progress",
                                ImageProgressEvent {
                                    file_id: file_id.clone(),
                                    progress,
                                },
                            );
                        }
                    },
                )
            }
            _ => {
                return Err(CompressionError::TaskFailed(
                    "process options did not match workflow".to_string(),
                ))
            }
        };
        let result = result?;
        log::info!(
            "process done workflow=\"{:?}\" format={:?} original={} output={} output_path=\"{}\" elapsed_ms={}",
            workflow,
            result.format,
            result.original_size,
            result.output_size,
            output_path.display(),
            started.elapsed().as_millis()
        );
        Ok(result)
    });

    match task.await {
        Ok(Ok(result)) => {
            let elapsed_ms = started.elapsed().as_millis();
            report_task_success(&app, workflow, &options_for_report, elapsed_ms, &result);
            Ok(result)
        }
        Ok(Err(err)) => {
            let elapsed_ms = started.elapsed().as_millis();
            report_task_error(&app, workflow, &options_for_report, elapsed_ms, &err);
            log::error!("process error path=\"{}\" err={}", path_for_log, err);
            Err(err)
        }
        Err(err) => {
            let elapsed_ms = started.elapsed().as_millis();
            report_task_failure(&app, workflow, &options_for_report, elapsed_ms, &err);
            log::error!("process task error path=\"{}\" err={}", path_for_log, err);
            Err(CompressionError::TaskFailed(err.to_string()))
        }
    }
}

#[tauri::command]
async fn prepare_remove_bg_models(app: tauri::AppHandle) -> Result<(), CompressionError> {
    let app_handle = app.clone();
    let task = tauri::async_runtime::spawn_blocking(move || {
        background_removal::ensure_remove_bg_models_with_progress(&app_handle, |progress| {
            let _ = app_handle.emit(
                "model-download-progress",
                ModelDownloadProgressEvent { progress },
            );
        })
    });

    match task.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(err)) => {
            log::error!("model download error err={}", err);
            Err(err)
        }
        Err(err) => {
            log::error!("model download task error err={}", err);
            Err(CompressionError::TaskFailed(err.to_string()))
        }
    }
}

#[tauri::command]
async fn prepare_blur_text_models(app: tauri::AppHandle) -> Result<(), CompressionError> {
    let app_handle = app.clone();
    let task = tauri::async_runtime::spawn_blocking(move || {
        text_blur::ensure_text_models_with_progress(&app_handle, |progress| {
            let _ = app_handle.emit(
                "text-model-download-progress",
                ModelDownloadProgressEvent { progress },
            );
        })
    });

    match task.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(err)) => {
            log::error!("text model download error err={}", err);
            Err(err)
        }
        Err(err) => {
            log::error!("text model download task error err={}", err);
            Err(CompressionError::TaskFailed(err.to_string()))
        }
    }
}

static APP_VERSION: LazyLock<Option<String>> = LazyLock::new(|| {
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).ok()?;
    config.get("version")?.as_str().map(String::from)
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let posthog_enabled = Arc::new(AtomicBool::new(true));
    let posthog_before_send = {
        let posthog_enabled = Arc::clone(&posthog_enabled);
        Box::new(move |mut event: better_posthog::Event| {
            if !posthog_enabled.load(Ordering::Relaxed) {
                return None;
            }
            if let Some(version) = APP_VERSION.as_ref() {
                event
                    .properties
                    .insert("app_version".to_string(), version.clone().into());
            }
            Some(event)
        })
    };
    let _posthog_guard = better_posthog::init(better_posthog::ClientOptions {
        api_key: Some("phc_2ekaZ68N70y43laV2KyLBxPsnv7n3EGbPIXOXUhWnDM".into()),
        host: better_posthog::Host::US,
        before_send: vec![posthog_before_send],
        ..Default::default()
    });
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_better_posthog::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            process_file,
            count_drag_items,
            expand_paths,
            get_platform,
            set_posthog_enabled,
            set_menu_bar_icon_visible,
            reveal_in_finder,
            set_titlebar_color,
            prepare_remove_bg_models,
            prepare_blur_text_models,
            download_update_to_cache,
            install_cached_update,
            get_cached_update_version,
            clear_update_cache
        ])
        .setup(move |app| {
            app.manage(PostHogControl {
                enabled: Arc::clone(&posthog_enabled),
            });
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let ns_window = window.ns_window().unwrap();
                set_window_bg_color(ns_window, 255, 255, 255);
                set_window_level_floating(ns_window);
            }
            #[cfg(desktop)]
            {
                let icon = tauri::image::Image::from_bytes(TRAY_ICON_BYTES);
                match icon {
                    Ok(icon) => {
                        let tray = TrayIconBuilder::with_id("main")
                            .icon(icon)
                            .on_tray_icon_event(|tray, event| {
                                if let TrayIconEvent::Click {
                                    button: MouseButton::Left,
                                    ..
                                } = event
                                {
                                    if let Some(window) =
                                        tray.app_handle().get_webview_window("main")
                                    {
                                        let _ = window.unminimize();
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            })
                            .build(app);
                        if let Err(err) = tray {
                            log::error!("tray icon build failed: {err}");
                        }
                    }
                    Err(err) => {
                        log::error!("tray icon load failed: {err}");
                    }
                }
            }
            log::info!("app started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        build_label, count_drag_items, error_kind, expand_paths, workflow_properties, BlurMode,
        BlurTextOptions, CompressOptions, ProcessOptions, RemoveBgOptions, RemoveBgOutputFormat,
    };
    use crate::compression::CompressionError;
    use crate::conversion::{ConvertOptions, ConvertOutputFormat};
    use crate::workflow::Workflow;
    use std::collections::HashSet;
    use std::fs;
    use std::path::Path;
    use tempfile::tempdir;

    fn write_file(path: &Path) {
        fs::write(path, b"test").expect("write test file");
    }

    #[test]
    fn count_drag_items_counts_files_and_folders() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("image.png");
        let unsupported_path = dir.path().join("notes.txt");
        let compressed_path = dir.path().join("photo_compressed.jpg");
        let folder_path = dir.path().join("folder");
        let missing_path = dir.path().join("missing.txt");

        write_file(&file_path);
        write_file(&unsupported_path);
        write_file(&compressed_path);
        fs::create_dir(&folder_path).expect("create folder");

        let counts = count_drag_items(
            vec![
                file_path.to_string_lossy().to_string(),
                unsupported_path.to_string_lossy().to_string(),
                compressed_path.to_string_lossy().to_string(),
                folder_path.to_string_lossy().to_string(),
                missing_path.to_string_lossy().to_string(),
            ],
            Workflow::Compress,
            None,
        );

        assert_eq!(counts.file_count, 3);
        assert_eq!(counts.folder_count, 1);
        assert_eq!(counts.skipped_count, 2);
    }

    #[test]
    fn expand_paths_includes_files_and_depth_one_children() {
        let dir = tempdir().expect("tempdir");
        let root_file = dir.path().join("root.jpg");
        let first_dir = dir.path().join("first");
        let first_file = first_dir.join("one.png");
        let nested_dir = first_dir.join("nested");
        let nested_file = nested_dir.join("two.webp");
        let deep_dir = nested_dir.join("deep");
        let deep_file = deep_dir.join("three.webp");

        write_file(&root_file);
        fs::create_dir(&first_dir).expect("create first dir");
        write_file(&first_file);
        fs::create_dir(&nested_dir).expect("create nested dir");
        write_file(&nested_file);
        fs::create_dir(&deep_dir).expect("create deep dir");
        write_file(&deep_file);

        let output = expand_paths(vec![
            root_file.to_string_lossy().to_string(),
            first_dir.to_string_lossy().to_string(),
        ]);

        let output_set: HashSet<String> = output.into_iter().collect();
        assert!(output_set.contains(&root_file.to_string_lossy().to_string()));
        assert!(output_set.contains(&first_file.to_string_lossy().to_string()));
        assert!(output_set.contains(&nested_file.to_string_lossy().to_string()));
        assert!(!output_set.contains(&deep_file.to_string_lossy().to_string()));
        assert!(!output_set.contains(&first_dir.to_string_lossy().to_string()));
        assert!(!output_set.contains(&nested_dir.to_string_lossy().to_string()));
    }

    #[test]
    fn workflow_properties_compress_are_safe_and_complete() {
        let options = ProcessOptions::Compress(CompressOptions {
            override_original: true,
            strip_png_metadata: false,
            strip_jpeg_metadata: true,
        });
        let properties = workflow_properties(Workflow::Compress, &options, 123);
        assert_eq!(
            properties.get("workflow").and_then(|v| v.as_str()),
            Some("compress")
        );
        assert_eq!(
            properties.get("elapsed_ms").and_then(|v| v.as_u64()),
            Some(123)
        );
        assert_eq!(
            properties.get("build").and_then(|v| v.as_str()),
            Some(build_label())
        );
        assert_eq!(
            properties
                .get("override_original")
                .and_then(|v| v.as_bool()),
            Some(true)
        );
        assert_eq!(
            properties
                .get("strip_png_metadata")
                .and_then(|v| v.as_bool()),
            Some(false)
        );
        assert_eq!(
            properties
                .get("strip_jpeg_metadata")
                .and_then(|v| v.as_bool()),
            Some(true)
        );
        let keys: HashSet<String> = properties.keys().cloned().collect();
        let expected: HashSet<String> = [
            "workflow",
            "elapsed_ms",
            "build",
            "override_original",
            "strip_png_metadata",
            "strip_jpeg_metadata",
        ]
        .iter()
        .map(|value| value.to_string())
        .collect();
        assert_eq!(keys, expected);
    }

    #[test]
    fn workflow_properties_convert_are_safe_and_complete() {
        let options = ProcessOptions::Convert(ConvertOptions {
            output_format: ConvertOutputFormat::Jpeg,
            jpeg_quality: 85,
            png_compression_level: 4,
            webp_quality: 70,
            webp_lossless: false,
            gif_colors: 128,
        });
        let properties = workflow_properties(Workflow::Convert, &options, 450);
        assert_eq!(
            properties.get("workflow").and_then(|v| v.as_str()),
            Some("convert")
        );
        assert_eq!(
            properties.get("elapsed_ms").and_then(|v| v.as_u64()),
            Some(450)
        );
        assert_eq!(
            properties.get("build").and_then(|v| v.as_str()),
            Some(build_label())
        );
        assert_eq!(
            properties.get("output_format").and_then(|v| v.as_str()),
            Some("jpeg")
        );
        assert_eq!(
            properties.get("jpeg_quality").and_then(|v| v.as_u64()),
            Some(85)
        );
        assert_eq!(
            properties
                .get("png_compression_level")
                .and_then(|v| v.as_u64()),
            Some(4)
        );
        assert_eq!(
            properties.get("webp_quality").and_then(|v| v.as_u64()),
            Some(70)
        );
        assert_eq!(
            properties.get("webp_lossless").and_then(|v| v.as_bool()),
            Some(false)
        );
        assert_eq!(
            properties.get("gif_colors").and_then(|v| v.as_u64()),
            Some(128)
        );
        let keys: HashSet<String> = properties.keys().cloned().collect();
        let expected: HashSet<String> = [
            "workflow",
            "elapsed_ms",
            "build",
            "output_format",
            "jpeg_quality",
            "png_compression_level",
            "webp_quality",
            "webp_lossless",
            "gif_colors",
        ]
        .iter()
        .map(|value| value.to_string())
        .collect();
        assert_eq!(keys, expected);
    }

    #[test]
    fn workflow_properties_remove_bg_are_safe_and_complete() {
        let options = ProcessOptions::RemoveBg(RemoveBgOptions {
            output_format: RemoveBgOutputFormat::Webp,
        });
        let properties = workflow_properties(Workflow::RemoveBg, &options, 999);
        assert_eq!(
            properties.get("workflow").and_then(|v| v.as_str()),
            Some("remove_bg")
        );
        assert_eq!(
            properties.get("elapsed_ms").and_then(|v| v.as_u64()),
            Some(999)
        );
        assert_eq!(
            properties.get("build").and_then(|v| v.as_str()),
            Some(build_label())
        );
        assert_eq!(
            properties.get("output_format").and_then(|v| v.as_str()),
            Some("webp")
        );
        let keys: HashSet<String> = properties.keys().cloned().collect();
        let expected: HashSet<String> = ["workflow", "elapsed_ms", "build", "output_format"]
            .iter()
            .map(|value| value.to_string())
            .collect();
        assert_eq!(keys, expected);
    }

    #[test]
    fn workflow_properties_blur_text_are_safe_and_complete() {
        let options = ProcessOptions::BlurText(BlurTextOptions {
            override_original: false,
            blur_mode: BlurMode::Pixelate,
            blur_strength: 18,
            padding: 4,
            confidence_threshold: 0.55,
            min_box_size: 10,
        });
        let properties = workflow_properties(Workflow::BlurText, &options, 321);
        assert_eq!(
            properties.get("workflow").and_then(|v| v.as_str()),
            Some("blur_text")
        );
        assert_eq!(
            properties.get("elapsed_ms").and_then(|v| v.as_u64()),
            Some(321)
        );
        assert_eq!(
            properties.get("build").and_then(|v| v.as_str()),
            Some(build_label())
        );
        assert_eq!(
            properties
                .get("override_original")
                .and_then(|v| v.as_bool()),
            Some(false)
        );
        assert_eq!(
            properties.get("blur_mode").and_then(|v| v.as_str()),
            Some("pixelate")
        );
        assert_eq!(
            properties.get("blur_strength").and_then(|v| v.as_u64()),
            Some(18)
        );
        assert_eq!(properties.get("padding").and_then(|v| v.as_u64()), Some(4));
        let confidence = properties
            .get("confidence_threshold")
            .and_then(|v| v.as_f64())
            .expect("confidence_threshold");
        assert!((confidence - 0.55).abs() < 1e-6);
        assert_eq!(
            properties.get("min_box_size").and_then(|v| v.as_u64()),
            Some(10)
        );
        let keys: HashSet<String> = properties.keys().cloned().collect();
        let expected: HashSet<String> = [
            "workflow",
            "elapsed_ms",
            "build",
            "override_original",
            "blur_mode",
            "blur_strength",
            "padding",
            "confidence_threshold",
            "min_box_size",
        ]
        .iter()
        .map(|value| value.to_string())
        .collect();
        assert_eq!(keys, expected);
    }

    #[test]
    fn error_kind_maps_variants() {
        assert_eq!(
            error_kind(&CompressionError::UnsupportedFormat),
            "unsupported_format"
        );
        assert_eq!(
            error_kind(&CompressionError::DecodeFailed("nope".to_string())),
            "decode_failed"
        );
        assert_eq!(
            error_kind(&CompressionError::EncodeFailed("nope".to_string())),
            "encode_failed"
        );
        assert_eq!(
            error_kind(&CompressionError::TaskFailed("nope".to_string())),
            "task_failed"
        );
        assert_eq!(
            error_kind(&CompressionError::IoError("nope".to_string())),
            "io_error"
        );
    }
}
