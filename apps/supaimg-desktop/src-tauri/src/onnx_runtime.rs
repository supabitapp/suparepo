use crate::compression::CompressionError;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

static ORT_INIT: OnceLock<()> = OnceLock::new();

pub fn ensure_ort_initialized(onnxruntime_path: &Path) -> Result<(), CompressionError> {
    if ORT_INIT.get().is_some() {
        return Ok(());
    }
    ort::init_from(onnxruntime_path.to_string_lossy())
        .commit()
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
    let _ = ORT_INIT.set(());
    Ok(())
}

#[cfg(target_os = "macos")]
fn resolve_onnxruntime_path_from_frameworks(
    app: &AppHandle,
) -> Result<Option<PathBuf>, CompressionError> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
    let frameworks_path = resource_dir
        .parent()
        .map(|path| path.join("Frameworks/libonnxruntime.dylib"));
    if let Some(path) = frameworks_path {
        if path.exists() {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

pub fn resolve_onnxruntime_path(app: &AppHandle) -> Result<PathBuf, CompressionError> {
    if let Some(path) = resolve_onnxruntime_path_from_env()? {
        return Ok(path);
    }
    #[cfg(target_os = "macos")]
    if let Some(path) = resolve_onnxruntime_path_from_frameworks(app)? {
        return Ok(path);
    }
    if let Some(path) = resolve_onnxruntime_path_from_resource(app)? {
        return Ok(path);
    }
    Err(CompressionError::TaskFailed(
        "onnxruntime not found. Bundle the dylib in resources or set ORT_DYLIB_PATH.".to_string(),
    ))
}

pub fn resolve_onnxruntime_path_cli() -> Result<PathBuf, CompressionError> {
    if let Some(path) = resolve_onnxruntime_path_from_env()? {
        return Ok(path);
    }
    let cwd = std::env::current_dir()?;
    let candidates = [
        cwd.join("models/onnxruntime"),
        cwd.join("apps/desktop/src-tauri/models/onnxruntime"),
    ];
    for dir in candidates {
        if let Some(found) = resolve_onnxruntime_path_from_dir(&dir) {
            return Ok(found);
        }
    }
    Err(CompressionError::TaskFailed(
        "onnxruntime not found. Set ORT_DYLIB_PATH.".to_string(),
    ))
}

pub fn resolve_onnxruntime_path_from_dir(dir: &Path) -> Option<PathBuf> {
    let (platform, filename) = onnxruntime_platform();
    let path = dir.join(platform).join(filename);
    if path.exists() {
        return Some(path);
    }
    None
}

fn onnxruntime_platform() -> (&'static str, &'static str) {
    if cfg!(target_os = "windows") {
        ("windows", "onnxruntime.dll")
    } else if cfg!(target_os = "macos") {
        ("macos", "libonnxruntime.dylib")
    } else {
        ("linux", "libonnxruntime.so")
    }
}

fn resolve_onnxruntime_path_from_env() -> Result<Option<PathBuf>, CompressionError> {
    let value = match std::env::var("ORT_DYLIB_PATH") {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let path = PathBuf::from(value);
    if path.is_file() {
        return Ok(Some(path));
    }
    if path.is_dir() {
        return Ok(resolve_onnxruntime_path_from_dir(&path));
    }
    Err(CompressionError::TaskFailed(
        "onnxruntime not found".to_string(),
    ))
}

fn onnxruntime_resource_dir(app: &AppHandle) -> Result<PathBuf, CompressionError> {
    app.path()
        .resolve("models/onnxruntime", BaseDirectory::Resource)
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))
}

fn resolve_onnxruntime_path_from_resource(
    app: &AppHandle,
) -> Result<Option<PathBuf>, CompressionError> {
    let dir = onnxruntime_resource_dir(app)?;
    Ok(resolve_onnxruntime_path_from_dir(&dir))
}
