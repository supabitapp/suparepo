use crate::compression::CompressionError;
use image::DynamicImage;
use std::fs;
use std::path::Path;

pub fn load_oriented_image(path: &Path) -> Result<DynamicImage, CompressionError> {
    let data = fs::read(path)?;
    let mut image = image::load_from_memory(&data)
        .map_err(|err| CompressionError::DecodeFailed(err.to_string()))?;
    if let Some(orientation) = read_exif_orientation(&data) {
        image = apply_exif_orientation(image, orientation);
    }
    Ok(image)
}

fn apply_exif_orientation(image: DynamicImage, orientation: u16) -> DynamicImage {
    match orientation {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.rotate90().fliph(),
        6 => image.rotate90(),
        7 => image.rotate270().fliph(),
        8 => image.rotate270(),
        _ => image,
    }
}

fn read_exif_orientation(data: &[u8]) -> Option<u16> {
    if data.len() < 4 || data[0] != 0xFF || data[1] != 0xD8 {
        return None;
    }
    let mut index = 2;
    while index + 1 < data.len() {
        if data[index] != 0xFF {
            break;
        }
        let mut marker = data[index + 1];
        while marker == 0xFF {
            index += 1;
            if index + 1 >= data.len() {
                return None;
            }
            marker = data[index + 1];
        }
        index += 2;
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        if (0xD0..=0xD7).contains(&marker) {
            continue;
        }
        if index + 1 >= data.len() {
            return None;
        }
        let length = u16::from_be_bytes([data[index], data[index + 1]]) as usize;
        if length < 2 || index + length > data.len() {
            return None;
        }
        if marker == 0xE1 {
            let segment = &data[index + 2..index + length];
            if segment.len() >= 6 && &segment[..6] == b"Exif\0\0" {
                if let Some(orientation) = parse_tiff_orientation(&segment[6..]) {
                    return Some(orientation);
                }
            }
        }
        index += length;
    }
    None
}

fn parse_tiff_orientation(data: &[u8]) -> Option<u16> {
    if data.len() < 8 {
        return None;
    }
    let endian = match &data[0..2] {
        b"II" => Endian::Little,
        b"MM" => Endian::Big,
        _ => return None,
    };
    if read_u16(data, 2, endian)? != 0x002A {
        return None;
    }
    let offset = read_u32(data, 4, endian)? as usize;
    if offset + 2 > data.len() {
        return None;
    }
    let count = read_u16(data, offset, endian)? as usize;
    let entries_start = offset + 2;
    let entries_len = count.checked_mul(12)?;
    if entries_start + entries_len > data.len() {
        return None;
    }
    let mut cursor = entries_start;
    for _ in 0..count {
        let tag = read_u16(data, cursor, endian)?;
        if tag == 0x0112 {
            let format = read_u16(data, cursor + 2, endian)?;
            let components = read_u32(data, cursor + 4, endian)?;
            if format == 3 && components == 1 {
                let value = read_u16(data, cursor + 8, endian)?;
                return Some(value);
            }
        }
        cursor += 12;
    }
    None
}

#[derive(Copy, Clone)]
enum Endian {
    Little,
    Big,
}

fn read_u16(data: &[u8], offset: usize, endian: Endian) -> Option<u16> {
    let bytes = data.get(offset..offset + 2)?;
    Some(match endian {
        Endian::Little => u16::from_le_bytes([bytes[0], bytes[1]]),
        Endian::Big => u16::from_be_bytes([bytes[0], bytes[1]]),
    })
}

fn read_u32(data: &[u8], offset: usize, endian: Endian) -> Option<u32> {
    let bytes = data.get(offset..offset + 4)?;
    Some(match endian {
        Endian::Little => u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        Endian::Big => u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
    })
}
