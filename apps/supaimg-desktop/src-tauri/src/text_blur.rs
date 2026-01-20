use crate::compression::{
    self, output, CompressionError, CompressionOptions, ImageFormat, ImageResult,
};
use crate::generated::workflow_settings::{
    BLUR_TEXT_BLUR_STRENGTH_MAX, BLUR_TEXT_BLUR_STRENGTH_MIN, BLUR_TEXT_CONFIDENCE_THRESHOLD_MAX,
    BLUR_TEXT_CONFIDENCE_THRESHOLD_MIN, BLUR_TEXT_MIN_BOX_SIZE_MAX, BLUR_TEXT_MIN_BOX_SIZE_MIN,
    BLUR_TEXT_PADDING_MAX, BLUR_TEXT_PADDING_MIN,
};
use crate::image_utils::load_oriented_image;
use crate::model_download::download_file;
use crate::onnx_runtime::{ensure_ort_initialized, resolve_onnxruntime_path};
use crate::{BlurMode, BlurTextOptions};
use image::imageops::{blur, resize, FilterType};
use image::{DynamicImage, GenericImageView, ImageEncoder, RgbImage, Rgba, RgbaImage};
use ndarray::{Array4, Ix2, Ix3, Ix4};
use ort::execution_providers::CPUExecutionProvider;
use ort::inputs;
use ort::session::Session;
use ort::value::TensorRef;
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const MODEL_BASE_URL: &str = "https://supaimg.app/appassets";
const MODEL_FILE: &str = "pp-ocrv5-server-det.onnx";
const MODEL_REMOTE_PATH: &str = "pp-ocrv5-server-det.onnx";
const MAX_SIDE: u32 = 1280;
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

static SESSION_POOL: OnceLock<Mutex<Vec<Session>>> = OnceLock::new();
static MODEL_DOWNLOAD_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Clone, Copy)]
struct Rect {
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
}

pub fn blur_text_with_progress<F: FnMut(f64) + Send>(
    app: &AppHandle,
    input_path: &Path,
    output_path: &Path,
    options: &BlurTextOptions,
    on_progress: F,
) -> Result<ImageResult, CompressionError> {
    let model_path = resolve_model_path(app)?;
    let onnxruntime_path = resolve_onnxruntime_path(app)?;
    blur_text_with_progress_paths(
        input_path,
        output_path,
        options,
        &model_path,
        &onnxruntime_path,
        on_progress,
    )
}

pub fn blur_text_with_progress_paths<F: FnMut(f64) + Send>(
    input_path: &Path,
    output_path: &Path,
    options: &BlurTextOptions,
    model_path: &Path,
    onnxruntime_path: &Path,
    mut on_progress: F,
) -> Result<ImageResult, CompressionError> {
    on_progress(0.0);
    let original_size = fs::metadata(input_path)?.len() as usize;
    let image = load_oriented_image(input_path)?;
    let (orig_width, orig_height) = image.dimensions();
    on_progress(0.05);

    let rgb = image.to_rgb8();
    let (resized, scale) = resize_for_model(&rgb, MAX_SIDE);
    let (input_w, input_h) = resized.dimensions();
    on_progress(0.1);

    let input_tensor = build_input_tensor(&resized)?;
    on_progress(0.2);

    let output = with_session(model_path, onnxruntime_path, |session| {
        let tensor = TensorRef::from_array_view(&input_tensor)
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
        let outputs = session
            .run(inputs![tensor])
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
        if outputs.len() == 0 {
            return Err(CompressionError::TaskFailed(
                "text model returned no outputs".to_string(),
            ));
        }
        outputs[0]
            .try_extract_array::<f32>()
            .map_err(|err| CompressionError::TaskFailed(err.to_string()))
            .map(|view| view.to_owned())
    })?;
    on_progress(0.5);

    let (scores, mask_w, mask_h) = extract_score_map(output)?;
    let threshold = options.confidence_threshold.clamp(
        BLUR_TEXT_CONFIDENCE_THRESHOLD_MIN,
        BLUR_TEXT_CONFIDENCE_THRESHOLD_MAX,
    );
    let mask = scores
        .iter()
        .map(|&value| if value >= threshold { 1u8 } else { 0u8 })
        .collect::<Vec<u8>>();
    let min_box = options
        .min_box_size
        .clamp(BLUR_TEXT_MIN_BOX_SIZE_MIN, BLUR_TEXT_MIN_BOX_SIZE_MAX) as u32;
    let padding = options
        .padding
        .clamp(BLUR_TEXT_PADDING_MIN, BLUR_TEXT_PADDING_MAX) as u32;
    let mut boxes = extract_boxes(&mask, mask_w, mask_h, min_box, padding);
    let scale_x = input_w as f32 / mask_w.max(1) as f32;
    let scale_y = input_h as f32 / mask_h.max(1) as f32;
    if (scale_x - 1.0).abs() > f32::EPSILON || (scale_y - 1.0).abs() > f32::EPSILON {
        boxes = boxes
            .into_iter()
            .map(|rect| scale_rect_to_input(rect, scale_x, scale_y, input_w, input_h))
            .collect();
    }
    on_progress(0.65);

    if scale > 0.0 {
        boxes = boxes
            .into_iter()
            .filter_map(|rect| map_rect_to_original(rect, scale, orig_width, orig_height))
            .collect();
    }

    let mut rgba = image.to_rgba8();
    apply_blur(&mut rgba, &boxes, options);
    on_progress(0.85);

    let format = compression::detect_format_from_path(input_path)?;
    let encoded = encode_image(&rgba, format)?;
    let options = CompressionOptions {
        strip_png_metadata: false,
        strip_jpeg_metadata: true,
        png_compression_level: 2,
        webp_lossless: true,
        webp_quality: 75,
    };
    let output = compression::compress_image(encoded, format, options)?;
    let temp_output = output::temp_path_for_output(output_path)?;
    fs::write(&temp_output, &output.data)?;
    temp_output
        .persist(output_path)
        .map_err(|err| CompressionError::IoError(err.to_string()))?;
    on_progress(1.0);

    Ok(ImageResult {
        original_size,
        output_size: output.data.len(),
        format: output.result.format,
    })
}

pub fn ensure_text_models_with_progress<F: FnMut(f64) + Send>(
    app: &AppHandle,
    on_progress: F,
) -> Result<(), CompressionError> {
    let model_dir = model_app_data_dir(app)?;
    ensure_text_models_in_dir_with_progress(&model_dir, on_progress)
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
    ensure_text_models_in_dir_with_progress(&app_data, |_| {})?;
    resolve_model_path_from_dir(&app_data).ok_or_else(|| {
        CompressionError::TaskFailed("model not found. Set TEXT_BLUR_MODEL_PATH.".to_string())
    })
}

fn resolve_model_path_from_env() -> Result<Option<PathBuf>, CompressionError> {
    let value = match std::env::var("TEXT_BLUR_MODEL_PATH") {
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

fn resolve_model_path_from_dir(dir: &Path) -> Option<PathBuf> {
    let model_path = dir.join(MODEL_FILE);
    if model_path.exists() {
        return Some(model_path);
    }
    None
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

fn ensure_text_models_in_dir_with_progress<F: FnMut(f64) + Send>(
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
    let url = format!("{MODEL_BASE_URL}/{MODEL_REMOTE_PATH}");
    on_progress(0.0);
    download_file(&url, &model_path, |progress| {
        on_progress(progress.clamp(0.0, 1.0));
    })?;
    on_progress(1.0);
    Ok(())
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

fn resize_for_model(image: &RgbImage, max_side: u32) -> (RgbImage, f32) {
    let (width, height) = image.dimensions();
    let max_dim = width.max(height);
    let scale = if max_dim > max_side {
        max_side as f32 / max_dim as f32
    } else {
        1.0
    };
    let resized_width = (width as f32 * scale).round().max(1.0) as u32;
    let resized_height = (height as f32 * scale).round().max(1.0) as u32;
    let resized = resize(image, resized_width, resized_height, FilterType::Triangle);
    let padded_width = resized_width.div_ceil(32) * 32;
    let padded_height = resized_height.div_ceil(32) * 32;
    if padded_width == resized_width && padded_height == resized_height {
        return (resized, scale);
    }
    let mut padded = RgbImage::new(padded_width, padded_height);
    for (x, y, pixel) in resized.enumerate_pixels() {
        padded.put_pixel(x, y, *pixel);
    }
    (padded, scale)
}

fn build_input_tensor(image: &RgbImage) -> Result<Array4<f32>, CompressionError> {
    let (width, height) = image.dimensions();
    let mut input = Array4::<f32>::zeros((1, 3, height as usize, width as usize));
    for (x, y, pixel) in image.enumerate_pixels() {
        let r = pixel[0] as f32 / 255.0;
        let g = pixel[1] as f32 / 255.0;
        let b = pixel[2] as f32 / 255.0;
        let x = x as usize;
        let y = y as usize;
        input[[0, 0, y, x]] = (r - MEAN[0]) / STD[0];
        input[[0, 1, y, x]] = (g - MEAN[1]) / STD[1];
        input[[0, 2, y, x]] = (b - MEAN[2]) / STD[2];
    }
    Ok(input)
}

fn extract_score_map(
    output: ndarray::ArrayD<f32>,
) -> Result<(Vec<f32>, usize, usize), CompressionError> {
    match output.ndim() {
        4 => {
            let view = output
                .into_dimensionality::<Ix4>()
                .map_err(|_| CompressionError::TaskFailed("unexpected output shape".to_string()))?;
            let (n, c, h, w) = view.dim();
            if n != 1 {
                return Err(CompressionError::TaskFailed(
                    "unexpected output batch".to_string(),
                ));
            }
            let (height, width, channel_first) = if c == 1 {
                (h, w, true)
            } else if view.dim().3 == 1 {
                (view.dim().1, view.dim().2, false)
            } else {
                (h, w, true)
            };
            let mut scores = Vec::with_capacity(height * width);
            if channel_first {
                for y in 0..height {
                    for x in 0..width {
                        scores.push(view[[0, 0, y, x]]);
                    }
                }
            } else {
                for y in 0..height {
                    for x in 0..width {
                        scores.push(view[[0, y, x, 0]]);
                    }
                }
            }
            Ok((scores, width, height))
        }
        3 => {
            let view = output
                .into_dimensionality::<Ix3>()
                .map_err(|_| CompressionError::TaskFailed("unexpected output shape".to_string()))?;
            let dims = view.dim();
            if dims.0 == 1 {
                let (h, w) = (dims.1, dims.2);
                let mut scores = Vec::with_capacity(h * w);
                for y in 0..h {
                    for x in 0..w {
                        scores.push(view[[0, y, x]]);
                    }
                }
                return Ok((scores, w, h));
            }
            if dims.2 == 1 {
                let (h, w) = (dims.0, dims.1);
                let mut scores = Vec::with_capacity(h * w);
                for y in 0..h {
                    for x in 0..w {
                        scores.push(view[[y, x, 0]]);
                    }
                }
                return Ok((scores, w, h));
            }
            Err(CompressionError::TaskFailed(
                "unexpected output channels".to_string(),
            ))
        }
        2 => {
            let view = output
                .into_dimensionality::<Ix2>()
                .map_err(|_| CompressionError::TaskFailed("unexpected output shape".to_string()))?;
            let (h, w) = view.dim();
            let mut scores = Vec::with_capacity(h * w);
            for y in 0..h {
                for x in 0..w {
                    scores.push(view[[y, x]]);
                }
            }
            Ok((scores, w, h))
        }
        _ => Err(CompressionError::TaskFailed(
            "unexpected output shape".to_string(),
        )),
    }
}

fn extract_boxes(
    mask: &[u8],
    width: usize,
    height: usize,
    min_box: u32,
    padding: u32,
) -> Vec<Rect> {
    let mut visited = vec![false; mask.len()];
    let mut boxes = Vec::new();
    let neighbors = [
        (-1i32, -1i32),
        (0, -1),
        (1, -1),
        (-1, 0),
        (1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
    ];

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            if mask[idx] == 0 || visited[idx] {
                continue;
            }
            let mut queue = VecDeque::new();
            queue.push_back((x as i32, y as i32));
            visited[idx] = true;
            let mut min_x = x as i32;
            let mut max_x = x as i32;
            let mut min_y = y as i32;
            let mut max_y = y as i32;
            while let Some((cx, cy)) = queue.pop_front() {
                for (dx, dy) in neighbors {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if nx < 0 || ny < 0 {
                        continue;
                    }
                    let nx = nx as usize;
                    let ny = ny as usize;
                    if nx >= width || ny >= height {
                        continue;
                    }
                    let nidx = ny * width + nx;
                    if mask[nidx] == 0 || visited[nidx] {
                        continue;
                    }
                    visited[nidx] = true;
                    queue.push_back((nx as i32, ny as i32));
                    min_x = min_x.min(nx as i32);
                    max_x = max_x.max(nx as i32);
                    min_y = min_y.min(ny as i32);
                    max_y = max_y.max(ny as i32);
                }
            }
            let box_width = (max_x - min_x + 1) as u32;
            let box_height = (max_y - min_y + 1) as u32;
            if box_width < min_box || box_height < min_box {
                continue;
            }
            let pad = padding as i32;
            let x0 = (min_x - pad).max(0) as u32;
            let y0 = (min_y - pad).max(0) as u32;
            let x1 = (max_x + pad).min(width.saturating_sub(1) as i32) as u32;
            let y1 = (max_y + pad).min(height.saturating_sub(1) as i32) as u32;
            boxes.push(Rect { x0, y0, x1, y1 });
        }
    }
    boxes
}

fn map_rect_to_original(rect: Rect, scale: f32, orig_width: u32, orig_height: u32) -> Option<Rect> {
    if scale <= 0.0 {
        return None;
    }
    let x0 = ((rect.x0 as f32) / scale).floor() as i32;
    let y0 = ((rect.y0 as f32) / scale).floor() as i32;
    let x1 = ((rect.x1.saturating_add(1)) as f32 / scale).ceil() as i32 - 1;
    let y1 = ((rect.y1.saturating_add(1)) as f32 / scale).ceil() as i32 - 1;
    let x0 = x0.clamp(0, orig_width.saturating_sub(1) as i32) as u32;
    let y0 = y0.clamp(0, orig_height.saturating_sub(1) as i32) as u32;
    let x1 = x1.clamp(0, orig_width.saturating_sub(1) as i32) as u32;
    let y1 = y1.clamp(0, orig_height.saturating_sub(1) as i32) as u32;
    if x1 < x0 || y1 < y0 {
        return None;
    }
    Some(Rect { x0, y0, x1, y1 })
}

fn scale_rect_to_input(
    rect: Rect,
    scale_x: f32,
    scale_y: f32,
    max_width: u32,
    max_height: u32,
) -> Rect {
    let x0 = (rect.x0 as f32 * scale_x).floor() as i32;
    let y0 = (rect.y0 as f32 * scale_y).floor() as i32;
    let x1 = ((rect.x1.saturating_add(1)) as f32 * scale_x).ceil() as i32 - 1;
    let y1 = ((rect.y1.saturating_add(1)) as f32 * scale_y).ceil() as i32 - 1;
    let x0 = x0.clamp(0, max_width.saturating_sub(1) as i32) as u32;
    let y0 = y0.clamp(0, max_height.saturating_sub(1) as i32) as u32;
    let x1 = x1.clamp(0, max_width.saturating_sub(1) as i32) as u32;
    let y1 = y1.clamp(0, max_height.saturating_sub(1) as i32) as u32;
    Rect { x0, y0, x1, y1 }
}

fn apply_blur(image: &mut RgbaImage, boxes: &[Rect], options: &BlurTextOptions) {
    let strength = options
        .blur_strength
        .clamp(BLUR_TEXT_BLUR_STRENGTH_MIN, BLUR_TEXT_BLUR_STRENGTH_MAX) as u32;
    for rect in boxes {
        let width = rect.x1.saturating_sub(rect.x0).saturating_add(1);
        let height = rect.y1.saturating_sub(rect.y0).saturating_add(1);
        if width == 0 || height == 0 {
            continue;
        }
        let sub = image::imageops::crop_imm(image, rect.x0, rect.y0, width, height).to_image();
        let processed = match options.blur_mode {
            BlurMode::Gaussian => blur(&sub, strength as f32),
            BlurMode::Pixelate => pixelate(&sub, strength),
            BlurMode::Solid => solid_fill(&sub),
        };
        for y in 0..height {
            for x in 0..width {
                let px = processed.get_pixel(x, y);
                image.put_pixel(rect.x0 + x, rect.y0 + y, *px);
            }
        }
    }
}

fn pixelate(image: &RgbaImage, strength: u32) -> RgbaImage {
    let (width, height) = image.dimensions();
    let divisor = strength.max(1);
    let small_w = (width / divisor).max(1);
    let small_h = (height / divisor).max(1);
    let small = resize(image, small_w, small_h, FilterType::Nearest);
    resize(&small, width, height, FilterType::Nearest)
}

fn solid_fill(image: &RgbaImage) -> RgbaImage {
    let (width, height) = image.dimensions();
    let mut output = RgbaImage::new(width, height);
    for (x, y, pixel) in image.enumerate_pixels() {
        output.put_pixel(x, y, Rgba([127, 127, 127, pixel[3]]));
    }
    output
}

fn encode_image(image: &RgbaImage, format: ImageFormat) -> Result<Vec<u8>, CompressionError> {
    match format {
        ImageFormat::Jpeg => encode_jpeg(image, 95),
        ImageFormat::Png => encode_png(image, 6),
        ImageFormat::WebP => encode_webp(image, true, 90),
        ImageFormat::Gif => Err(CompressionError::UnsupportedFormat),
    }
}

fn encode_jpeg(image: &RgbaImage, quality: u8) -> Result<Vec<u8>, CompressionError> {
    let base = DynamicImage::ImageRgba8(image.clone());
    let rgb = if base.color().has_alpha() {
        flatten_to_rgb(base)
    } else {
        base.to_rgb8()
    };
    let (width, height) = rgb.dimensions();
    let mut data = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut data, quality);
    encoder
        .encode(&rgb, width, height, image::ColorType::Rgb8.into())
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    Ok(data)
}

fn encode_png(image: &RgbaImage, compression_level: u8) -> Result<Vec<u8>, CompressionError> {
    let (width, height) = image.dimensions();
    compression::encode_png_rgba(image.as_raw(), width, height, compression_level)
}

fn encode_webp(
    image: &RgbaImage,
    lossless: bool,
    quality: u8,
) -> Result<Vec<u8>, CompressionError> {
    let base = DynamicImage::ImageRgba8(image.clone());
    if lossless {
        let mut output = Vec::new();
        let (width, height) = base.dimensions();
        let rgba = base.to_rgba8();
        let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut output);
        encoder
            .write_image(
                rgba.as_raw(),
                width,
                height,
                image::ExtendedColorType::Rgba8,
            )
            .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
        return Ok(output);
    }
    let encoder = webp::Encoder::from_image(&base)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    let quality = quality.clamp(0, 100) as f32;
    Ok(encoder.encode(quality).to_vec())
}

fn flatten_to_rgb(image: DynamicImage) -> image::RgbImage {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut rgb = image::RgbImage::new(width, height);
    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = pixel[3] as u32;
        let inv = 255 - alpha;
        let r = (pixel[0] as u32 * alpha + 255 * inv + 127) / 255;
        let g = (pixel[1] as u32 * alpha + 255 * inv + 127) / 255;
        let b = (pixel[2] as u32 * alpha + 255 * inv + 127) / 255;
        rgb.put_pixel(x, y, image::Rgb([r as u8, g as u8, b as u8]));
    }
    rgb
}

#[cfg(test)]
mod tests {
    use super::{blur_text_with_progress_paths, resolve_model_path_cli};
    use crate::compression::ImageFormat;
    use crate::generated::workflow_settings::{
        BLUR_TEXT_BLUR_MODE_DEFAULT, BLUR_TEXT_BLUR_STRENGTH_DEFAULT,
        BLUR_TEXT_CONFIDENCE_THRESHOLD_DEFAULT, BLUR_TEXT_MIN_BOX_SIZE_DEFAULT,
        BLUR_TEXT_OVERRIDE_ORIGINAL_DEFAULT, BLUR_TEXT_PADDING_DEFAULT,
    };
    use crate::onnx_runtime::resolve_onnxruntime_path_cli;
    use crate::BlurTextOptions;
    use image::GenericImageView;
    use std::path::{Path, PathBuf};
    use tempfile::tempdir;

    fn asset_path(dir: &str, name: &str) -> PathBuf {
        Path::new("test_assets").join(dir).join(name)
    }

    fn should_run_text_blur_tests() -> bool {
        std::env::var("RUN_TEXT_BLUR_TESTS").ok().as_deref() == Some("1")
    }

    fn blur_options() -> BlurTextOptions {
        BlurTextOptions {
            override_original: BLUR_TEXT_OVERRIDE_ORIGINAL_DEFAULT,
            blur_mode: BLUR_TEXT_BLUR_MODE_DEFAULT,
            blur_strength: BLUR_TEXT_BLUR_STRENGTH_DEFAULT,
            padding: BLUR_TEXT_PADDING_DEFAULT,
            confidence_threshold: BLUR_TEXT_CONFIDENCE_THRESHOLD_DEFAULT,
            min_box_size: BLUR_TEXT_MIN_BOX_SIZE_DEFAULT,
        }
    }

    #[test]
    fn blur_text_preserves_png_format() {
        if !should_run_text_blur_tests() {
            return;
        }
        let input_path = asset_path("png", "small_files.png");
        let model_path = resolve_model_path_cli().expect("model path");
        let onnxruntime_path = resolve_onnxruntime_path_cli().expect("onnxruntime path");
        let dir = tempdir().expect("tempdir");
        let output_path = dir.path().join("blurred.png");
        let options = blur_options();
        let result = blur_text_with_progress_paths(
            &input_path,
            &output_path,
            &options,
            &model_path,
            &onnxruntime_path,
            |_| {},
        )
        .expect("blur text");
        assert_eq!(result.format, ImageFormat::Png);
        let output = std::fs::read(&output_path).expect("read output");
        let decoded = image::load_from_memory(&output).expect("decode output");
        let input = image::open(&input_path).expect("decode input");
        assert_eq!(decoded.dimensions(), input.dimensions());
    }

    #[test]
    fn blur_text_preserves_webp_format() {
        if !should_run_text_blur_tests() {
            return;
        }
        let input_path = asset_path("webp", "1.webp");
        let model_path = resolve_model_path_cli().expect("model path");
        let onnxruntime_path = resolve_onnxruntime_path_cli().expect("onnxruntime path");
        let dir = tempdir().expect("tempdir");
        let output_path = dir.path().join("blurred.webp");
        let options = blur_options();
        let result = blur_text_with_progress_paths(
            &input_path,
            &output_path,
            &options,
            &model_path,
            &onnxruntime_path,
            |_| {},
        )
        .expect("blur text");

        assert_eq!(result.format, ImageFormat::WebP);
        let output = std::fs::read(&output_path).expect("read output");
        assert!(output.len() >= 12);
        assert_eq!(&output[0..4], b"RIFF");
        assert_eq!(&output[8..12], b"WEBP");
        let decoded = image::load_from_memory(&output).expect("decode output");
        let input = image::open(&input_path).expect("decode input");
        assert_eq!(decoded.dimensions(), input.dimensions());
    }
}
