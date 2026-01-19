use super::CompressionError;
use image::GenericImageView;
use std::path::Path;

pub fn compress(input: &[u8], lossless: bool, quality: u8) -> Result<Vec<u8>, CompressionError> {
    let image = decode_image(input)?;
    let (width, height) = image.dimensions();
    let quality = quality.clamp(0, 100) as f32;

    let encoded = if image.color().has_alpha() {
        let rgba = image.to_rgba8();
        let encoder = webp::Encoder::from_rgba(&rgba, width, height);
        encoder.encode_simple(lossless, quality)
    } else {
        let rgb = image.to_rgb8();
        let encoder = webp::Encoder::from_rgb(&rgb, width, height);
        encoder.encode_simple(lossless, quality)
    };

    encoded
        .map(|data| data.to_vec())
        .map_err(|err| CompressionError::EncodeFailed(format!("{err:?}")))
}

pub fn compress_path(
    input_path: &Path,
    output_path: &Path,
    lossless: bool,
    quality: u8,
) -> Result<(), CompressionError> {
    let image = decode_image_path(input_path)?;
    let (width, height) = image.dimensions();
    let quality = quality.clamp(0, 100) as f32;

    let encoded = if image.color().has_alpha() {
        let rgba = image.to_rgba8();
        let encoder = webp::Encoder::from_rgba(&rgba, width, height);
        encoder.encode_simple(lossless, quality)
    } else {
        let rgb = image.to_rgb8();
        let encoder = webp::Encoder::from_rgb(&rgb, width, height);
        encoder.encode_simple(lossless, quality)
    };

    let data = encoded.map_err(|err| CompressionError::EncodeFailed(format!("{err:?}")))?;
    std::fs::write(output_path, &*data)?;
    Ok(())
}

fn decode_image(input: &[u8]) -> Result<image::DynamicImage, CompressionError> {
    image::load_from_memory(input).map_err(|err| CompressionError::DecodeFailed(err.to_string()))
}

fn decode_image_path(path: &Path) -> Result<image::DynamicImage, CompressionError> {
    image::open(path).map_err(|err| CompressionError::DecodeFailed(err.to_string()))
}
