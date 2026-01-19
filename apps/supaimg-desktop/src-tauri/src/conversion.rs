use crate::compression::{encode_png_rgba, CompressionError, ImageFormat, ImageResult};
use crate::generated::workflow_settings::{
    ConvertOutputFormat, CONVERT_GIF_COLORS_MAX, CONVERT_GIF_COLORS_MIN, CONVERT_JPEG_QUALITY_MAX,
    CONVERT_JPEG_QUALITY_MIN, CONVERT_PNG_COMPRESSION_LEVEL_MAX, CONVERT_PNG_COMPRESSION_LEVEL_MIN,
    CONVERT_WEBP_QUALITY_MAX, CONVERT_WEBP_QUALITY_MIN,
};
use color_quant::NeuQuant;
use gif::Encoder as GifEncoder;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::webp::WebPEncoder;
use image::{ColorType, DynamicImage, ExtendedColorType, GenericImageView, ImageEncoder};
use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConvertOptions {
    pub output_format: ConvertOutputFormat,
    pub jpeg_quality: u8,
    pub png_compression_level: u8,
    pub webp_quality: u8,
    pub webp_lossless: bool,
    pub gif_colors: u16,
}

pub fn convert_path_with_progress<F: FnMut(f64) + Send>(
    input_path: &Path,
    output_path: &Path,
    options: ConvertOptions,
    mut on_progress: F,
) -> Result<ImageResult, CompressionError> {
    on_progress(0.0);
    let original_size = fs::metadata(input_path)?.len() as usize;
    let image =
        image::open(input_path).map_err(|err| CompressionError::DecodeFailed(err.to_string()))?;
    on_progress(0.4);

    let (data, format) = match options.output_format {
        ConvertOutputFormat::Jpeg => {
            let quality = options
                .jpeg_quality
                .clamp(CONVERT_JPEG_QUALITY_MIN, CONVERT_JPEG_QUALITY_MAX);
            let rgb = if image.color().has_alpha() {
                flatten_to_rgb(image)
            } else {
                image.to_rgb8()
            };
            let (width, height) = rgb.dimensions();
            on_progress(0.7);
            let mut data = Vec::new();
            let mut encoder = JpegEncoder::new_with_quality(&mut data, quality);
            encoder
                .encode(&rgb, width, height, ColorType::Rgb8.into())
                .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
            (data, ImageFormat::Jpeg)
        }
        ConvertOutputFormat::Png => {
            let rgba = image.to_rgba8();
            let (width, height) = rgba.dimensions();
            on_progress(0.7);
            let compression = options.png_compression_level.clamp(
                CONVERT_PNG_COMPRESSION_LEVEL_MIN,
                CONVERT_PNG_COMPRESSION_LEVEL_MAX,
            );
            let data = encode_png_rgba(rgba.as_raw(), width, height, compression)?;
            (data, ImageFormat::Png)
        }
        ConvertOutputFormat::Webp => {
            let base = if image.color().has_alpha() {
                DynamicImage::ImageRgba8(image.to_rgba8())
            } else {
                DynamicImage::ImageRgb8(image.to_rgb8())
            };
            on_progress(0.7);
            let data = if options.webp_lossless {
                let mut output = Vec::new();
                let (width, height) = base.dimensions();
                let rgba = base.to_rgba8();
                let encoder = WebPEncoder::new_lossless(&mut output);
                encoder
                    .write_image(rgba.as_raw(), width, height, ExtendedColorType::Rgba8)
                    .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
                output
            } else {
                let encoder = webp::Encoder::from_image(&base)
                    .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
                let quality = options
                    .webp_quality
                    .clamp(CONVERT_WEBP_QUALITY_MIN, CONVERT_WEBP_QUALITY_MAX)
                    as f32;
                encoder.encode(quality).to_vec()
            };
            (data, ImageFormat::WebP)
        }
        ConvertOutputFormat::Gif => {
            let rgba = image.to_rgba8();
            let (width, height) = rgba.dimensions();
            on_progress(0.7);
            let colors = options
                .gif_colors
                .clamp(CONVERT_GIF_COLORS_MIN, CONVERT_GIF_COLORS_MAX)
                as usize;
            let pixels = rgba.into_raw();
            let has_alpha = pixels.chunks(4).any(|pixel| pixel[3] < 255);
            let palette_colors = if has_alpha && colors > 1 {
                colors - 1
            } else {
                colors
            };
            let quant = NeuQuant::new(10, palette_colors, &pixels);
            let mut palette = quant.color_map_rgb();
            let transparent_index = if has_alpha { Some(0u8) } else { None };
            if has_alpha {
                let mut next = Vec::with_capacity(palette.len() + 3);
                next.extend_from_slice(&[0, 0, 0]);
                next.extend_from_slice(&palette);
                palette = next;
            }
            let mut indexed = Vec::with_capacity((width * height) as usize);
            for pixel in pixels.chunks(4) {
                if has_alpha && pixel[3] < 128 {
                    indexed.push(0);
                } else {
                    let mut idx = quant.index_of(pixel) as u8;
                    if has_alpha {
                        idx = idx.saturating_add(1);
                    }
                    indexed.push(idx);
                }
            }
            let width = u16::try_from(width)
                .map_err(|_| CompressionError::EncodeFailed("gif width too large".into()))?;
            let height = u16::try_from(height)
                .map_err(|_| CompressionError::EncodeFailed("gif height too large".into()))?;
            let frame =
                gif::Frame::from_palette_pixels(width, height, indexed, palette, transparent_index);
            let mut data = Vec::new();
            {
                let mut encoder = GifEncoder::new(&mut data, width, height, &[])
                    .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
                encoder
                    .write_frame(&frame)
                    .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
            }
            (data, ImageFormat::Gif)
        }
    };
    on_progress(0.9);

    fs::write(output_path, &data)?;
    on_progress(1.0);

    Ok(ImageResult {
        original_size,
        output_size: data.len(),
        format,
    })
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
    use super::*;
    use crate::compression::detect_format;
    use tempfile::tempdir;

    fn base_options(format: ConvertOutputFormat) -> ConvertOptions {
        ConvertOptions {
            output_format: format,
            jpeg_quality: 90,
            png_compression_level: 6,
            webp_quality: 90,
            webp_lossless: false,
            gif_colors: 128,
        }
    }

    #[test]
    fn converts_png_to_jpeg() {
        let dir = tempdir().expect("tempdir");
        let input_path = dir.path().join("input.png");
        let output_path = dir.path().join("output.jpg");
        fs::copy("test_assets/png/filter_0_for_rgba_8.png", &input_path).expect("copy fixture");

        let result = convert_path_with_progress(
            &input_path,
            &output_path,
            base_options(ConvertOutputFormat::Jpeg),
            |_| {},
        )
        .expect("convert succeeds");
        assert_eq!(result.format, ImageFormat::Jpeg);

        let output_bytes = fs::read(&output_path).expect("read output");
        assert_eq!(detect_format(&output_bytes), Some(ImageFormat::Jpeg));
        assert_eq!(output_bytes.len(), result.output_size);
    }

    #[test]
    fn converts_png_to_png() {
        let dir = tempdir().expect("tempdir");
        let input_path = dir.path().join("input.png");
        let output_path = dir.path().join("output.png");
        fs::copy("test_assets/png/filter_0_for_rgba_8.png", &input_path).expect("copy fixture");

        let result = convert_path_with_progress(
            &input_path,
            &output_path,
            base_options(ConvertOutputFormat::Png),
            |_| {},
        )
        .expect("convert succeeds");
        assert_eq!(result.format, ImageFormat::Png);

        let output_bytes = fs::read(&output_path).expect("read output");
        assert_eq!(detect_format(&output_bytes), Some(ImageFormat::Png));
        assert_eq!(output_bytes.len(), result.output_size);
    }

    #[test]
    fn converts_png_to_webp() {
        let dir = tempdir().expect("tempdir");
        let input_path = dir.path().join("input.png");
        let output_path = dir.path().join("output.webp");
        fs::copy("test_assets/png/filter_0_for_rgba_8.png", &input_path).expect("copy fixture");

        let result = convert_path_with_progress(
            &input_path,
            &output_path,
            base_options(ConvertOutputFormat::Webp),
            |_| {},
        )
        .expect("convert succeeds");
        assert_eq!(result.format, ImageFormat::WebP);

        let output_bytes = fs::read(&output_path).expect("read output");
        assert_eq!(detect_format(&output_bytes), Some(ImageFormat::WebP));
        assert_eq!(output_bytes.len(), result.output_size);
    }

    #[test]
    fn converts_png_to_gif() {
        let dir = tempdir().expect("tempdir");
        let input_path = dir.path().join("input.png");
        let output_path = dir.path().join("output.gif");
        fs::copy("test_assets/png/filter_0_for_rgba_8.png", &input_path).expect("copy fixture");

        let result = convert_path_with_progress(
            &input_path,
            &output_path,
            base_options(ConvertOutputFormat::Gif),
            |_| {},
        )
        .expect("convert succeeds");
        assert_eq!(result.format, ImageFormat::Gif);

        let output_bytes = fs::read(&output_path).expect("read output");
        assert_eq!(detect_format(&output_bytes), Some(ImageFormat::Gif));
        assert_eq!(output_bytes.len(), result.output_size);
    }
}
