use super::CompressionError;
use oxipng::{InFile, OutFile};
use std::path::Path;
use std::time::Duration;

fn preset_from_level(level: u8) -> u8 {
    level.clamp(1, 9).min(6)
}

fn options_from_level(level: u8) -> oxipng::Options {
    let mut options = oxipng::Options::from_preset(preset_from_level(level));
    options.timeout = Some(Duration::from_secs(30));
    options
}

pub fn compress(input: &[u8], level: u8) -> Result<Vec<u8>, CompressionError> {
    let options = options_from_level(level);
    oxipng::optimize_from_memory(input, &options)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))
}

pub fn compress_path(
    input_path: &Path,
    output_path: &Path,
    level: u8,
) -> Result<(), CompressionError> {
    let options = options_from_level(level);
    let input = InFile::Path(input_path.to_path_buf());
    let output = OutFile::from_path(output_path.to_path_buf());
    oxipng::optimize(&input, &output, &options)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))
}

pub fn strip_metadata(data: &[u8]) -> Option<Vec<u8>> {
    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
    if data.len() < PNG_SIGNATURE.len() || &data[0..8] != PNG_SIGNATURE.as_slice() {
        return None;
    }

    let mut output = Vec::with_capacity(data.len());
    output.extend_from_slice(&data[0..8]);
    let mut index = 8;
    while index + 8 <= data.len() {
        let length = u32::from_be_bytes([
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
        ]) as usize;
        let chunk_type = &data[index + 4..index + 8];
        let end = index + 12 + length;
        if end > data.len() {
            return None;
        }

        let strip = chunk_type == b"gAMA"
            || chunk_type == b"cHRM"
            || chunk_type == b"iCCP"
            || chunk_type == b"sRGB"
            || chunk_type == b"tEXt"
            || chunk_type == b"zTXt"
            || chunk_type == b"iTXt"
            || chunk_type == b"eXIf"
            || chunk_type == b"bKGD"
            || chunk_type == b"pHYs"
            || chunk_type == b"tIME"
            || chunk_type == b"sPLT"
            || chunk_type == b"hIST";

        if !strip {
            output.extend_from_slice(&data[index..end]);
        }

        index = end;
        if chunk_type == b"IEND" {
            break;
        }
    }

    Some(output)
}
