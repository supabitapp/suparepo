use crate::compression::{
    compress_image, output, CompressionError, CompressionOptions, ImageFormat, ImageResult,
};
use crate::image_utils::load_oriented_image;
use crate::model_download::download_file;
use crate::onnx_runtime::{ensure_ort_initialized, resolve_onnxruntime_path};
use image::{imageops::FilterType, GenericImageView, RgbaImage};
use ndarray::Array4;
use ort::execution_providers::CPUExecutionProvider;
use ort::inputs;
use ort::session::Session;
use ort::value::TensorRef;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use webp::Encoder;

const MODEL_SIZE: u32 = 1024;
const MODEL_BASE_URL: &str = "https://supaimg.app/models";
const MODEL_FILE: &str = "model_quantized.onnx";
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

static SESSION_POOL: OnceLock<Mutex<Vec<Session>>> = OnceLock::new();
static MODEL_DOWNLOAD_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

struct RemoveBgOutput {
    rgba: RgbaImage,
    original_size: usize,
    width: u32,
    height: u32,
}

pub fn remove_background_with_progress<F: FnMut(f64) + Send>(
    app: &AppHandle,
    input_path: &Path,
    output_path: &Path,
    output_format: ImageFormat,
    on_progress: F,
) -> Result<ImageResult, CompressionError> {
    let model_path = resolve_model_path(app)?;
    let onnxruntime_path = resolve_onnxruntime_path(app)?;
    remove_background_with_progress_paths(
        input_path,
        output_path,
        output_format,
        &model_path,
        &onnxruntime_path,
        on_progress,
    )
}

pub fn remove_background_with_progress_paths<F: FnMut(f64) + Send>(
    input_path: &Path,
    output_path: &Path,
    output_format: ImageFormat,
    model_path: &Path,
    onnxruntime_path: &Path,
    mut on_progress: F,
) -> Result<ImageResult, CompressionError> {
    let format = match output_format {
        ImageFormat::WebP => ImageFormat::WebP,
        _ => ImageFormat::Png,
    };
    on_progress(0.0);
    let output = remove_background_rgba_with_progress(
        input_path,
        model_path,
        onnxruntime_path,
        &mut on_progress,
    )?;
    write_remove_bg_output(&output, format, output_path, &mut on_progress)
}

fn remove_background_rgba_with_progress(
    input_path: &Path,
    model_path: &Path,
    onnxruntime_path: &Path,
    on_progress: &mut dyn FnMut(f64),
) -> Result<RemoveBgOutput, CompressionError> {
    let original_size = fs::metadata(input_path)?.len() as usize;
    let image = load_oriented_image(input_path)?;
    let (width, height) = image.dimensions();
    on_progress(0.05);

    let rgb = image.to_rgb8();
    let resized = image::imageops::resize(&rgb, MODEL_SIZE, MODEL_SIZE, FilterType::Triangle);
    on_progress(0.1);
    let mut input = Array4::<f32>::zeros((1, 3, MODEL_SIZE as usize, MODEL_SIZE as usize));
    for (x, y, pixel) in resized.enumerate_pixels() {
        let r = pixel[0] as f32 / 255.0;
        let g = pixel[1] as f32 / 255.0;
        let b = pixel[2] as f32 / 255.0;
        let x = x as usize;
        let y = y as usize;
        input[[0, 0, y, x]] = (r - MEAN[0]) / STD[0];
        input[[0, 1, y, x]] = (g - MEAN[1]) / STD[1];
        input[[0, 2, y, x]] = (b - MEAN[2]) / STD[2];
        if (x as u32) + 1 == MODEL_SIZE {
            let ratio = (y as f64 + 1.0) / MODEL_SIZE as f64;
            on_progress(0.1 + ratio * 0.2);
        }
    }
    on_progress(0.3);

    let output = with_session(model_path, onnxruntime_path, |session| {
        let tensor = TensorRef::from_array_view(&input)
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
        let outputs = session
            .run(inputs![tensor])
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
        if outputs.len() != 1 {
            return Err(CompressionError::TaskFailed(
                "unexpected output count".to_string(),
            ));
        }
        Ok(outputs[0]
            .try_extract_array::<f32>()
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))?
            .to_owned())
    })?;
    on_progress(0.65);

    let shape = output.shape();
    let (mask_h, mask_w) = match shape.len() {
        2 => (shape[0], shape[1]),
        3 => (shape[1], shape[2]),
        4 => (shape[2], shape[3]),
        _ => {
            return Err(CompressionError::TaskFailed(
                "unexpected output shape".to_string(),
            ))
        }
    };
    if shape.len() > 2 && shape[..shape.len() - 2].iter().any(|&dim| dim != 1) {
        return Err(CompressionError::TaskFailed(
            "unexpected output channels".to_string(),
        ));
    }

    let mut mask_data = Vec::with_capacity(mask_h * mask_w);
    let mask_total = mask_h * mask_w;
    for (index, value) in output.iter().enumerate() {
        let alpha = value.clamp(0.0f32, 1.0f32);
        let scaled = (alpha * 255.0f32).round() as u8;
        mask_data.push(scaled);
        if (index + 1) % mask_w == 0 {
            let ratio = (index + 1) as f64 / mask_total as f64;
            on_progress(0.65 + ratio * 0.15);
        }
    }

    let mask = image::GrayImage::from_raw(mask_w as u32, mask_h as u32, mask_data)
        .ok_or_else(|| CompressionError::TaskFailed("invalid mask".to_string()))?;
    let mask_resized = image::imageops::resize(&mask, width, height, FilterType::CatmullRom);
    let mut rgba = image.to_rgba8();
    for (x, y, pixel) in rgba.enumerate_pixels_mut() {
        let mask_alpha = mask_resized.get_pixel(x, y)[0];
        let orig_alpha = pixel[3];
        let combined = (orig_alpha as u16 * mask_alpha as u16) / 255;
        pixel[3] = combined as u8;
        if x + 1 == width {
            let ratio = (y as f64 + 1.0) / height as f64;
            on_progress(0.8 + ratio * 0.15);
        }
    }
    on_progress(0.95);

    Ok(RemoveBgOutput {
        rgba,
        original_size,
        width,
        height,
    })
}

fn write_remove_bg_output(
    output: &RemoveBgOutput,
    format: ImageFormat,
    output_path: &Path,
    on_progress: &mut dyn FnMut(f64),
) -> Result<ImageResult, CompressionError> {
    if matches!(format, ImageFormat::WebP) {
        let encoder = Encoder::from_rgba(output.rgba.as_raw(), output.width, output.height);
        let encoded = encoder.encode_lossless();
        let data = encoded.to_vec();
        let temp_output = output::temp_path_for_output(output_path)?;
        fs::write(&temp_output, &data)?;
        temp_output
            .persist(output_path)
            .map_err(|err| CompressionError::IoError(err.to_string()))?;
        on_progress(1.0);
        return Ok(ImageResult {
            original_size: output.original_size,
            output_size: data.len(),
            format: ImageFormat::WebP,
        });
    }

    let mut data = Vec::new();
    let mut cursor = Cursor::new(&mut data);
    image::DynamicImage::ImageRgba8(output.rgba.clone())
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    on_progress(0.97);

    let options = CompressionOptions {
        strip_png_metadata: false,
        strip_jpeg_metadata: true,
        png_compression_level: 2,
        webp_lossless: true,
        webp_quality: 75,
    };
    let compressed = compress_image(data, format, options)?;
    let temp_output = output::temp_path_for_output(output_path)?;
    fs::write(&temp_output, &compressed.data)?;
    temp_output
        .persist(output_path)
        .map_err(|err| CompressionError::IoError(err.to_string()))?;
    on_progress(1.0);

    Ok(ImageResult {
        original_size: output.original_size,
        output_size: compressed.data.len(),
        format: compressed.result.format,
    })
}

fn with_session<F, T>(
    model_path: &Path,
    onnxruntime_path: &Path,
    f: F,
) -> Result<T, CompressionError>
where
    F: FnOnce(&mut Session) -> Result<T, CompressionError>,
{
    let pool = get_session_pool(model_path, onnxruntime_path)?;
    let session = {
        let mut pool = pool
            .lock()
            .map_err(|_| CompressionError::TaskFailed("session lock failed".to_string()))?;
        pool.pop()
    };
    let mut session = match session {
        Some(session) => session,
        None => build_session(model_path)?,
    };
    let result = f(&mut session);
    let mut pool = pool
        .lock()
        .map_err(|_| CompressionError::TaskFailed("session lock failed".to_string()))?;
    pool.push(session);
    result
}

fn get_session_pool(
    model_path: &Path,
    onnxruntime_path: &Path,
) -> Result<&'static Mutex<Vec<Session>>, CompressionError> {
    ensure_ort_initialized(onnxruntime_path)?;
    if let Some(pool) = SESSION_POOL.get() {
        return Ok(pool);
    }
    let size = session_pool_size();
    let mut sessions = Vec::with_capacity(size);
    for _ in 0..size {
        sessions.push(build_session(model_path)?);
    }
    let _ = SESSION_POOL.set(Mutex::new(sessions));
    SESSION_POOL
        .get()
        .ok_or_else(|| CompressionError::TaskFailed("session init failed".to_string()))
}

fn build_session(model_path: &Path) -> Result<Session, CompressionError> {
    Session::builder()
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))?
        .with_execution_providers([CPUExecutionProvider::default().build()])
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))?
        .commit_from_file(model_path)
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))
}

fn session_pool_size() -> usize {
    std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1)
        .clamp(1, 2)
}

pub fn ensure_remove_bg_models_with_progress<F: FnMut(f64) + Send>(
    app: &AppHandle,
    on_progress: F,
) -> Result<(), CompressionError> {
    let model_dir = model_app_data_dir(app)?;
    ensure_remove_bg_models_in_dir_with_progress(&model_dir, on_progress)
}

fn resolve_model_path(app: &AppHandle) -> Result<PathBuf, CompressionError> {
    if let Some(path) = resolve_model_path_from_env()? {
        return Ok(path);
    }
    let app_data = model_app_data_dir(app)?;
    resolve_model_path_from_dir(&app_data)
        .ok_or_else(|| CompressionError::TaskFailed("model not found".to_string()))
}

pub fn resolve_model_path_cli() -> Result<PathBuf, CompressionError> {
    if let Some(path) = resolve_model_path_from_env()? {
        return Ok(path);
    }
    let cwd = std::env::current_dir()?;
    let candidates = [
        cwd.join("models/onnx"),
        cwd.join("apps/supaimg-desktop/src-tauri/models/onnx"),
    ];
    for dir in candidates {
        if let Some(found) = resolve_model_path_from_dir(&dir) {
            return Ok(found);
        }
    }
    let app_data = model_app_data_dir_cli()?;
    if let Some(found) = resolve_model_path_from_dir(&app_data) {
        return Ok(found);
    }
    ensure_remove_bg_models_in_dir_with_progress(&app_data, |_| {})?;
    resolve_model_path_from_dir(&app_data).ok_or_else(|| {
        CompressionError::TaskFailed("model not found. Set RMBG_MODEL_PATH.".to_string())
    })
}

pub fn resolve_model_path_from_dir(dir: &Path) -> Option<PathBuf> {
    let quantized = dir.join("model_quantized.onnx");
    if quantized.exists() {
        return Some(quantized);
    }
    let full = dir.join("model.onnx");
    if full.exists() {
        return Some(full);
    }
    None
}

fn resolve_model_path_from_env() -> Result<Option<PathBuf>, CompressionError> {
    let value = match std::env::var("RMBG_MODEL_PATH") {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let path = PathBuf::from(value);
    if path.is_file() {
        return Ok(Some(path));
    }
    if path.is_dir() {
        return Ok(resolve_model_path_from_dir(&path));
    }
    Err(CompressionError::TaskFailed(
        "model path not found".to_string(),
    ))
}

fn model_app_data_dir(app: &AppHandle) -> Result<PathBuf, CompressionError> {
    app.path()
        .resolve("models/onnx", BaseDirectory::AppData)
        .map_err(|err| CompressionError::TaskFailed(err.to_string()))
}

fn model_app_data_dir_cli() -> Result<PathBuf, CompressionError> {
    let identifier = bundle_identifier()?;
    let base = dirs::data_dir()
        .ok_or_else(|| CompressionError::TaskFailed("app data dir not found".to_string()))?;
    Ok(base.join(identifier).join("models/onnx"))
}

fn bundle_identifier() -> Result<String, CompressionError> {
    let raw = include_str!("../tauri.conf.json");
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
    let identifier = value
        .get("identifier")
        .and_then(|val| val.as_str())
        .ok_or_else(|| CompressionError::TaskFailed("tauri identifier missing".to_string()))?;
    Ok(identifier.to_string())
}

fn ensure_remove_bg_models_in_dir_with_progress<F: FnMut(f64) + Send>(
    model_dir: &Path,
    mut on_progress: F,
) -> Result<(), CompressionError> {
    let model_env = resolve_model_path_from_env()?;
    let model_ready = model_env.is_some() || resolve_model_path_from_dir(model_dir).is_some();
    if model_ready {
        return Ok(());
    }
    let lock = MODEL_DOWNLOAD_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock
        .lock()
        .map_err(|_| CompressionError::TaskFailed("model download lock failed".to_string()))?;
    let model_ready = model_env.is_some() || resolve_model_path_from_dir(model_dir).is_some();
    if model_ready {
        return Ok(());
    }
    let model_path = model_dir.join(MODEL_FILE);
    let url = format!("{MODEL_BASE_URL}/{MODEL_FILE}");
    on_progress(0.0);
    download_file(&url, &model_path, |progress| {
        on_progress(progress.clamp(0.0, 1.0));
    })?;
    on_progress(1.0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        remove_background_rgba_with_progress, resolve_model_path_cli, write_remove_bg_output,
        RemoveBgOutput,
    };
    use crate::compression::ImageFormat;
    use crate::onnx_runtime::resolve_onnxruntime_path_cli;
    use image::GenericImageView;
    use std::path::{Path, PathBuf};
    use std::sync::OnceLock;
    use tempfile::tempdir;

    static REMOVE_BG_CACHE: OnceLock<RemoveBgOutput> = OnceLock::new();

    fn asset_path(name: &str) -> PathBuf {
        Path::new("test_assets").join("jpeg").join(name)
    }

    fn cached_remove_bg_output() -> &'static RemoveBgOutput {
        REMOVE_BG_CACHE.get_or_init(|| {
            let input_path = asset_path("photo-1529139574466-a303027c1d8b.jpeg");
            let model_path = resolve_model_path_cli().expect("model path");
            let onnxruntime_path = resolve_onnxruntime_path_cli().expect("onnxruntime path");
            let mut on_progress = |_| {};
            remove_background_rgba_with_progress(
                &input_path,
                &model_path,
                &onnxruntime_path,
                &mut on_progress,
            )
            .expect("remove background")
        })
    }

    fn should_run_remove_bg_tests() -> bool {
        std::env::var("RUN_RMBG_TESTS").ok().as_deref() == Some("1")
    }

    #[test]
    fn remove_background_produces_transparent_png() {
        if !should_run_remove_bg_tests() {
            return;
        }
        let dir = tempdir().expect("tempdir");
        let output_path = dir.path().join("removed.png");
        let cached = cached_remove_bg_output();
        let mut on_progress = |_| {};
        let result =
            write_remove_bg_output(cached, ImageFormat::Png, &output_path, &mut on_progress)
                .expect("remove background");

        assert_eq!(result.format, crate::compression::ImageFormat::Png);
        let output_bytes = std::fs::read(&output_path).expect("read output");
        let decoded = image::load_from_memory(&output_bytes).expect("decode output");
        assert_eq!(decoded.dimensions(), (cached.width, cached.height));
        let rgba = decoded.to_rgba8();
        let has_transparent = rgba.pixels().any(|pixel| pixel[3] < 255);
        assert!(has_transparent);
    }

    #[test]
    fn remove_background_preserves_webp_format() {
        if !should_run_remove_bg_tests() {
            return;
        }
        let dir = tempdir().expect("tempdir");
        let output_path = dir.path().join("removed.webp");
        let cached = cached_remove_bg_output();
        let mut on_progress = |_| {};
        let result =
            write_remove_bg_output(cached, ImageFormat::WebP, &output_path, &mut on_progress)
                .expect("remove background");

        assert_eq!(result.format, crate::compression::ImageFormat::WebP);
        let output_bytes = std::fs::read(&output_path).expect("read output");
        assert!(output_bytes.len() >= 12);
        assert_eq!(&output_bytes[0..4], b"RIFF");
        assert_eq!(&output_bytes[8..12], b"WEBP");
        let decoded = image::load_from_memory(&output_bytes).expect("decode output");
        assert_eq!(decoded.dimensions(), (cached.width, cached.height));
        let rgba = decoded.to_rgba8();
        let has_transparent = rgba.pixels().any(|pixel| pixel[3] < 255);
        assert!(has_transparent);
    }
}
