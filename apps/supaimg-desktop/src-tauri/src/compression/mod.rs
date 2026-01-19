mod gif;
mod jpeg;
pub mod output;
mod png;
mod webp;

use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ExtendedColorType, ImageEncoder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tempfile::TempPath;
use thiserror::Error;

#[derive(Debug, Copy, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImageFormat {
    Jpeg,
    Png,
    Gif,
    #[serde(rename = "webp")]
    WebP,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageResult {
    pub original_size: usize,
    pub output_size: usize,
    pub format: ImageFormat,
}

#[derive(Debug, Copy, Clone)]
pub struct CompressionOptions {
    pub strip_png_metadata: bool,
    pub strip_jpeg_metadata: bool,
    pub png_compression_level: u8,
    pub webp_lossless: bool,
    pub webp_quality: u8,
}

pub fn encode_png_rgba(
    data: &[u8],
    width: u32,
    height: u32,
    compression_level: u8,
) -> Result<Vec<u8>, CompressionError> {
    let level = compression_level.clamp(1, 9);
    let (compression, filter) = if level <= 3 {
        (CompressionType::Fast, FilterType::NoFilter)
    } else if level <= 6 {
        (CompressionType::Default, FilterType::Adaptive)
    } else {
        (CompressionType::Best, FilterType::Adaptive)
    };
    let mut output = Vec::new();
    let encoder = PngEncoder::new_with_quality(&mut output, compression, filter);
    encoder
        .write_image(data, width, height, ExtendedColorType::Rgba8)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    Ok(output)
}

pub struct ImageOutput {
    pub data: Vec<u8>,
    pub result: ImageResult,
}

#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message", rename_all = "snake_case")]
pub enum CompressionError {
    #[error("unsupported format")]
    UnsupportedFormat,
    #[error("decode failed: {0}")]
    DecodeFailed(String),
    #[error("encode failed: {0}")]
    EncodeFailed(String),
    #[error("task failed: {0}")]
    TaskFailed(String),
    #[error("io error: {0}")]
    IoError(String),
}

impl From<std::io::Error> for CompressionError {
    fn from(error: std::io::Error) -> Self {
        Self::IoError(error.to_string())
    }
}

pub fn detect_format(data: &[u8]) -> Option<ImageFormat> {
    if data.len() >= 3 && data[0..3] == [0xFF, 0xD8, 0xFF] {
        return Some(ImageFormat::Jpeg);
    }
    if data.len() >= 6 && (&data[0..6] == b"GIF87a" || &data[0..6] == b"GIF89a") {
        return Some(ImageFormat::Gif);
    }
    if data.len() >= 8 && data[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return Some(ImageFormat::Png);
    }
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return Some(ImageFormat::WebP);
    }
    None
}

pub fn detect_format_from_path(path: &Path) -> Result<ImageFormat, CompressionError> {
    let mut file = File::open(path)?;
    let mut header = [0u8; 64];
    let read = file.read(&mut header)?;
    detect_format(&header[..read]).ok_or(CompressionError::UnsupportedFormat)
}

pub fn compress_image(
    input: Vec<u8>,
    format: ImageFormat,
    options: CompressionOptions,
) -> Result<ImageOutput, CompressionError> {
    let original_size = input.len();
    let mut compressed = match format {
        ImageFormat::Jpeg => jpeg::compress(&input)?,
        ImageFormat::Png => png::compress(&input, options.png_compression_level)?,
        ImageFormat::Gif => gif::compress_gif_lossless(&input)?,
        ImageFormat::WebP => webp::compress(&input, options.webp_lossless, options.webp_quality)?,
    };

    if matches!(format, ImageFormat::Jpeg) {
        compressed = if options.strip_jpeg_metadata {
            jpeg::strip_metadata(&compressed).unwrap_or(compressed)
        } else {
            jpeg::preserve_metadata(&input, &compressed).unwrap_or(compressed)
        };
    }

    if matches!(format, ImageFormat::Png) && options.strip_png_metadata {
        compressed = png::strip_metadata(&compressed).unwrap_or(compressed);
    }

    let (data, compressed_size) = if compressed.len() > input.len() {
        let mut fallback = input;
        if let Some(stripped) = strip_metadata_from_bytes(&fallback, format, options) {
            fallback = stripped;
        }
        let size = fallback.len();
        (fallback, size)
    } else {
        let size = compressed.len();
        (compressed, size)
    };

    Ok(ImageOutput {
        data,
        result: ImageResult {
            original_size,
            output_size: compressed_size,
            format,
        },
    })
}

pub fn compress_auto(
    input: Vec<u8>,
    options: CompressionOptions,
) -> Result<ImageOutput, CompressionError> {
    let format = detect_format(&input).ok_or(CompressionError::UnsupportedFormat)?;
    compress_image(input, format, options)
}

pub fn compress_path(
    input_path: &Path,
    output_path: &Path,
    options: CompressionOptions,
) -> Result<ImageResult, CompressionError> {
    compress_path_with_progress(input_path, output_path, options, |_| {})
}

pub fn compress_path_with_progress<F: FnMut(f64) + Send>(
    input_path: &Path,
    output_path: &Path,
    options: CompressionOptions,
    mut on_progress: F,
) -> Result<ImageResult, CompressionError> {
    on_progress(0.0);
    let format = detect_format_from_path(input_path)?;
    let original_size = file_size(input_path)?;
    let temp_output = output::temp_path_for_output(output_path)?;

    if !matches!(format, ImageFormat::Gif) {
        on_progress(0.2);
    }

    match format {
        ImageFormat::Jpeg => {
            if options.strip_jpeg_metadata {
                let input = fs::read(input_path)?;
                let data = jpeg::compress(&input)?;
                fs::write(&temp_output, data)?;
            } else {
                jpeg::compress_path(input_path, &temp_output)?;
            }
        }
        ImageFormat::Png => {
            png::compress_path(input_path, &temp_output, options.png_compression_level)?
        }
        ImageFormat::Gif => {
            let input = fs::read(input_path)?;
            let data = gif::compress_gif_lossless_with_progress(&input, &mut on_progress)?;
            fs::write(&temp_output, data)?;
        }
        ImageFormat::WebP => webp::compress_path(
            input_path,
            &temp_output,
            options.webp_lossless,
            options.webp_quality,
        )?,
    }

    if !matches!(format, ImageFormat::Gif) {
        on_progress(0.8);
    }

    if matches!(format, ImageFormat::Jpeg) {
        let temp_data = fs::read(&temp_output)?;
        let next = if options.strip_jpeg_metadata {
            jpeg::strip_metadata(&temp_data).unwrap_or(temp_data)
        } else {
            let original_data = fs::read(input_path)?;
            jpeg::preserve_metadata(&original_data, &temp_data).unwrap_or(temp_data)
        };
        fs::write(&temp_output, next)?;
    }

    if matches!(format, ImageFormat::Png) && options.strip_png_metadata {
        let temp_data = fs::read(&temp_output)?;
        let next = png::strip_metadata(&temp_data).unwrap_or(temp_data);
        fs::write(&temp_output, next)?;
    }

    let result = finalize_output(
        temp_output,
        output_path,
        input_path,
        original_size,
        format,
        options,
    )?;
    on_progress(1.0);
    Ok(result)
}

fn file_size(path: &Path) -> Result<usize, CompressionError> {
    let len = fs::metadata(path)?.len();
    Ok(len as usize)
}

fn finalize_output(
    temp_output: TempPath,
    output_path: &Path,
    original_path: &Path,
    original_size: usize,
    format: ImageFormat,
    options: CompressionOptions,
) -> Result<ImageResult, CompressionError> {
    let compressed_size = file_size(&temp_output)?;
    if compressed_size > original_size {
        let stripped_original = if (matches!(format, ImageFormat::Jpeg)
            && options.strip_jpeg_metadata)
            || (matches!(format, ImageFormat::Png) && options.strip_png_metadata)
        {
            strip_metadata_from_path(original_path, format, options).ok()
        } else {
            None
        };
        if output_path == original_path {
            if let Some(stripped) = stripped_original {
                fs::write(output_path, &stripped)?;
                return Ok(ImageResult {
                    original_size,
                    output_size: stripped.len(),
                    format,
                });
            }
            return Ok(ImageResult {
                original_size,
                output_size: original_size,
                format,
            });
        }

        if let Some(stripped) = stripped_original {
            fs::write(output_path, &stripped)?;
            return Ok(ImageResult {
                original_size,
                output_size: stripped.len(),
                format,
            });
        }

        fs::copy(original_path, output_path)?;
        return Ok(ImageResult {
            original_size,
            output_size: original_size,
            format,
        });
    }

    if output_path == original_path {
        fs::copy(&*temp_output, output_path)?;
        return Ok(ImageResult {
            original_size,
            output_size: compressed_size,
            format,
        });
    }

    temp_output
        .persist(output_path)
        .map_err(|err| CompressionError::IoError(err.to_string()))?;

    Ok(ImageResult {
        original_size,
        output_size: compressed_size,
        format,
    })
}

fn strip_metadata_from_path(
    original_path: &Path,
    format: ImageFormat,
    options: CompressionOptions,
) -> Result<Vec<u8>, CompressionError> {
    let data = fs::read(original_path)?;
    strip_metadata_from_bytes(&data, format, options)
        .ok_or_else(|| CompressionError::EncodeFailed("metadata strip failed".to_string()))
}

fn strip_metadata_from_bytes(
    data: &[u8],
    format: ImageFormat,
    options: CompressionOptions,
) -> Option<Vec<u8>> {
    match format {
        ImageFormat::Jpeg if options.strip_jpeg_metadata => jpeg::strip_metadata(data),
        ImageFormat::Png if options.strip_png_metadata => png::strip_metadata(data),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const JPEG_FILES: [&str; 6] = [
        "exif-xmp-metadata.jpg",
        "iptc.jpg",
        "portrait_2.jpg",
        "3.jpg",
        "cat.jpg",
        "test.jpg",
    ];

    const PNG_FILES: [&str; 5] = [
        "filter_0_for_rgb_8.png",
        "filter_0_for_grayscale_8.png",
        "filter_0_for_grayscale_alpha_8.png",
        "filter_0_for_palette_1.png",
        "filter_0_for_palette_2.png",
    ];

    const GIF_FILES: [&str; 1] = ["1.gif"];

    const WEBP_FILES: [&str; 5] = ["1.webp", "2.webp", "3.webp", "4.webp", "5.webp"];

    fn read_asset(subdir: &str, name: &str) -> Vec<u8> {
        let path = format!("test_assets/{subdir}/{name}");
        std::fs::read(path).expect("test asset exists")
    }

    fn default_options() -> CompressionOptions {
        CompressionOptions {
            strip_png_metadata: true,
            strip_jpeg_metadata: true,
            png_compression_level: 2,
            webp_lossless: true,
            webp_quality: 75,
        }
    }

    #[test]
    fn detects_formats() {
        for name in JPEG_FILES {
            let data = read_asset("jpeg", name);
            assert_eq!(detect_format(&data), Some(ImageFormat::Jpeg));
        }

        for name in PNG_FILES {
            let data = read_asset("png", name);
            assert_eq!(detect_format(&data), Some(ImageFormat::Png));
        }

        for name in GIF_FILES {
            let data = read_asset("gif", name);
            assert_eq!(detect_format(&data), Some(ImageFormat::Gif));
        }

        for name in WEBP_FILES {
            let data = read_asset("webp", name);
            assert_eq!(detect_format(&data), Some(ImageFormat::WebP));
        }
    }

    #[test]
    fn compress_lossless_jpeg() {
        for name in JPEG_FILES {
            let data = read_asset("jpeg", name);
            let output = compress_image(data.clone(), ImageFormat::Jpeg, default_options())
                .expect("jpeg compression succeeds");
            assert!(output.result.output_size <= output.result.original_size);
            assert_eq!(detect_format(&output.data), Some(ImageFormat::Jpeg));
        }
    }

    #[test]
    fn compress_lossless_png() {
        for name in PNG_FILES {
            let data = read_asset("png", name);
            let output = compress_image(data.clone(), ImageFormat::Png, default_options())
                .expect("png compression succeeds");
            assert!(output.result.output_size <= output.result.original_size);
            assert_eq!(detect_format(&output.data), Some(ImageFormat::Png));
        }
    }

    #[test]
    fn compress_lossless_gif() {
        for name in GIF_FILES {
            let data = read_asset("gif", name);
            let output = compress_image(data.clone(), ImageFormat::Gif, default_options())
                .expect("gif compression succeeds");
            assert!(output.result.output_size <= output.result.original_size);
            assert_eq!(detect_format(&output.data), Some(ImageFormat::Gif));
        }
    }

    #[test]
    fn compress_lossless_webp() {
        for name in WEBP_FILES {
            let data = read_asset("webp", name);
            let output = compress_image(data.clone(), ImageFormat::WebP, default_options())
                .expect("webp compression succeeds");
            assert!(output.result.output_size <= output.result.original_size);
            assert_eq!(detect_format(&output.data), Some(ImageFormat::WebP));
        }
    }

    #[test]
    fn invalid_data_errors() {
        let data = b"not an image";
        let result = compress_auto(data.to_vec(), default_options());
        assert!(matches!(result, Err(CompressionError::UnsupportedFormat)));
    }
}
