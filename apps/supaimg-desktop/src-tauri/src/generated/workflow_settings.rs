use serde::Deserialize;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConvertOutputFormat {
    Jpeg,
    Png,
    Webp,
    Gif,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RemoveBgOutputFormat {
    Png,
    Webp,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlurMode {
    Pixelate,
    Gaussian,
    Solid,
}

pub const COMPRESS_OVERRIDE_ORIGINAL_DEFAULT: bool = false;
pub const COMPRESS_STRIP_PNG_METADATA_DEFAULT: bool = true;
pub const COMPRESS_STRIP_JPEG_METADATA_DEFAULT: bool = true;
pub const CONVERT_OUTPUT_FORMAT_DEFAULT: ConvertOutputFormat = ConvertOutputFormat::Jpeg;
pub const CONVERT_JPEG_QUALITY_MIN: u8 = 60;
pub const CONVERT_JPEG_QUALITY_MAX: u8 = 100;
pub const CONVERT_JPEG_QUALITY_DEFAULT: u8 = 100;
pub const CONVERT_PNG_COMPRESSION_LEVEL_MIN: u8 = 1;
pub const CONVERT_PNG_COMPRESSION_LEVEL_MAX: u8 = 9;
pub const CONVERT_PNG_COMPRESSION_LEVEL_DEFAULT: u8 = 6;
pub const CONVERT_WEBP_QUALITY_MIN: u8 = 60;
pub const CONVERT_WEBP_QUALITY_MAX: u8 = 100;
pub const CONVERT_WEBP_QUALITY_DEFAULT: u8 = 100;
pub const CONVERT_WEBP_LOSSLESS_DEFAULT: bool = true;
pub const CONVERT_GIF_COLORS_MIN: u16 = 2;
pub const CONVERT_GIF_COLORS_MAX: u16 = 256;
pub const CONVERT_GIF_COLORS_DEFAULT: u16 = 256;
pub const REMOVE_BG_OUTPUT_FORMAT_DEFAULT: RemoveBgOutputFormat = RemoveBgOutputFormat::Png;
pub const BLUR_TEXT_OVERRIDE_ORIGINAL_DEFAULT: bool = false;
pub const BLUR_TEXT_BLUR_MODE_DEFAULT: BlurMode = BlurMode::Gaussian;
pub const BLUR_TEXT_BLUR_STRENGTH_MIN: u8 = 2;
pub const BLUR_TEXT_BLUR_STRENGTH_MAX: u8 = 40;
pub const BLUR_TEXT_BLUR_STRENGTH_DEFAULT: u8 = 12;
pub const BLUR_TEXT_PADDING_MIN: u8 = 0;
pub const BLUR_TEXT_PADDING_MAX: u8 = 24;
pub const BLUR_TEXT_PADDING_DEFAULT: u8 = 6;
pub const BLUR_TEXT_CONFIDENCE_THRESHOLD_MIN: f32 = 0.3;
pub const BLUR_TEXT_CONFIDENCE_THRESHOLD_MAX: f32 = 0.9;
pub const BLUR_TEXT_CONFIDENCE_THRESHOLD_DEFAULT: f32 = 0.6;
pub const BLUR_TEXT_MIN_BOX_SIZE_MIN: u16 = 4;
pub const BLUR_TEXT_MIN_BOX_SIZE_MAX: u16 = 64;
pub const BLUR_TEXT_MIN_BOX_SIZE_DEFAULT: u16 = 8;
