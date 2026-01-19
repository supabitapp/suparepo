use super::CompressionError;
use mozjpeg_sys::*;
use std::ffi::c_void;
use std::fs;
use std::os::raw::c_ulong;
use std::path::Path;

pub fn compress(input: &[u8]) -> Result<Vec<u8>, CompressionError> {
    unsafe { compress_lossless_inner(input) }
}

pub fn compress_path(input_path: &Path, output_path: &Path) -> Result<(), CompressionError> {
    let input = fs::read(input_path)?;
    let data = unsafe { compress_lossless_inner(&input) }?;
    fs::write(output_path, data)?;
    Ok(())
}

pub fn strip_metadata(data: &[u8]) -> Option<Vec<u8>> {
    if data.len() < 2 || data[0] != 0xFF || data[1] != 0xD8 {
        return None;
    }

    let mut output = Vec::with_capacity(data.len());
    output.extend_from_slice(&data[0..2]);
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

        if marker == 0xDA {
            output.extend_from_slice(&data[index - 2..]);
            return Some(output);
        }

        if marker == 0xD9 {
            output.extend_from_slice(&data[index - 2..index]);
            return Some(output);
        }

        if (0xD0..=0xD7).contains(&marker) {
            output.extend_from_slice(&data[index - 2..index]);
            continue;
        }

        if index + 1 >= data.len() {
            return None;
        }
        let length = u16::from_be_bytes([data[index], data[index + 1]]) as usize;
        if length < 2 || index + length > data.len() {
            return None;
        }
        let segment_start = index - 2;
        let segment_end = index + length;
        let is_app = (0xE1..=0xEF).contains(&marker) && marker != 0xEE;
        let is_com = marker == 0xFE;
        if !(is_app || is_com) {
            output.extend_from_slice(&data[segment_start..segment_end]);
        }
        index += length;
    }

    None
}

pub fn preserve_metadata(original: &[u8], output: &[u8]) -> Option<Vec<u8>> {
    let segments = extract_metadata_segments(original);
    if segments.is_empty() {
        return Some(output.to_vec());
    }
    let stripped = strip_metadata(output).unwrap_or_else(|| output.to_vec());
    insert_metadata_segments(&stripped, &segments)
}

fn extract_metadata_segments(data: &[u8]) -> Vec<Vec<u8>> {
    if data.len() < 2 || data[0] != 0xFF || data[1] != 0xD8 {
        return Vec::new();
    }

    let mut segments = Vec::new();
    let mut index = 2;
    while index + 1 < data.len() {
        if data[index] != 0xFF {
            break;
        }
        let mut marker = data[index + 1];
        while marker == 0xFF {
            index += 1;
            if index + 1 >= data.len() {
                return segments;
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
            return segments;
        }
        let length = u16::from_be_bytes([data[index], data[index + 1]]) as usize;
        if length < 2 || index + length > data.len() {
            return segments;
        }
        let segment_start = index - 2;
        let segment_end = index + length;
        let is_app = (0xE1..=0xEF).contains(&marker) && marker != 0xEE;
        let is_com = marker == 0xFE;
        if is_app || is_com {
            segments.push(data[segment_start..segment_end].to_vec());
        }
        index += length;
    }

    segments
}

fn insert_metadata_segments(output: &[u8], segments: &[Vec<u8>]) -> Option<Vec<u8>> {
    if output.len() < 2 || output[0] != 0xFF || output[1] != 0xD8 {
        return None;
    }
    if segments.is_empty() {
        return Some(output.to_vec());
    }

    let mut insert_pos = 2;
    let mut index = 2;
    while index + 1 < output.len() && output[index] == 0xFF {
        let marker = output[index + 1];
        if marker == 0xE0 || marker == 0xEE {
            if index + 3 >= output.len() {
                break;
            }
            let length = u16::from_be_bytes([output[index + 2], output[index + 3]]) as usize;
            if length < 2 || index + 2 + length > output.len() {
                break;
            }
            index += 2 + length;
            insert_pos = index;
            continue;
        }
        break;
    }

    let extra = segments.iter().map(|segment| segment.len()).sum::<usize>();
    let mut merged = Vec::with_capacity(output.len() + extra);
    merged.extend_from_slice(&output[0..insert_pos]);
    for segment in segments {
        merged.extend_from_slice(segment);
    }
    merged.extend_from_slice(&output[insert_pos..]);
    Some(merged)
}

#[repr(C)]
struct JpegError {
    pub_: jpeg_error_mgr,
    message: [u8; 80],
}

struct JpegPanic(String);

unsafe extern "C-unwind" fn jpeg_error_exit(cinfo: &mut jpeg_common_struct) {
    let err = cinfo.err as *mut JpegError;
    if let Some(format_message) = (*err).pub_.format_message {
        format_message(cinfo, &(*err).message);
    }
    let message = (*err).message;
    let end = message
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(message.len());
    let message = String::from_utf8_lossy(&message[..end]).into_owned();
    let message = if message.is_empty() {
        "jpegtran failed".to_string()
    } else {
        message
    };
    std::panic::panic_any(JpegPanic(message));
}

#[allow(unused_assignments)]
unsafe fn compress_lossless_inner(input: &[u8]) -> Result<Vec<u8>, CompressionError> {
    let mut srcinfo: jpeg_decompress_struct = std::mem::zeroed();
    let mut dstinfo: jpeg_compress_struct = std::mem::zeroed();
    let mut jerr: JpegError = std::mem::zeroed();
    let true_flag: boolean = 1;
    let err_ptr = jpeg_std_error(&mut jerr.pub_) as *mut jpeg_error_mgr;
    jerr.pub_.error_exit = Some(jpeg_error_exit);
    srcinfo.common.err = err_ptr;
    dstinfo.common.err = err_ptr;

    let mut src_created = false;
    let mut dst_created = false;
    let mut outbuffer: *mut u8 = std::ptr::null_mut();
    let mut outsize: c_ulong = 0;

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        jpeg_create_decompress(&mut srcinfo);
        src_created = true;
        jpeg_mem_src(&mut srcinfo, input.as_ptr(), input.len() as c_ulong);
        jpeg_read_header(&mut srcinfo, true_flag);

        let coef_arrays = jpeg_read_coefficients(&mut srcinfo);

        jpeg_create_compress(&mut dstinfo);
        dst_created = true;
        jpeg_mem_dest(&mut dstinfo, &mut outbuffer, &mut outsize);

        jpeg_copy_critical_parameters(&srcinfo, &mut dstinfo);
        dstinfo.optimize_coding = true_flag;

        jpeg_write_coefficients(&mut dstinfo, coef_arrays);

        jpeg_finish_compress(&mut dstinfo);
        jpeg_finish_decompress(&mut srcinfo);
        Ok(())
    }));

    if dst_created {
        jpeg_destroy_compress(&mut dstinfo);
    }
    if src_created {
        jpeg_destroy_decompress(&mut srcinfo);
    }

    let result = match result {
        Ok(Ok(())) => {
            if outbuffer.is_null() {
                Err(CompressionError::EncodeFailed(
                    "jpegtran produced no output".to_string(),
                ))
            } else {
                let data = std::slice::from_raw_parts(outbuffer, outsize as usize).to_vec();
                Ok(data)
            }
        }
        Ok(Err(err)) => Err(err),
        Err(payload) => {
            if let Ok(panic) = payload.downcast::<JpegPanic>() {
                Err(CompressionError::EncodeFailed(panic.0))
            } else {
                Err(CompressionError::EncodeFailed(
                    "jpegtran failed".to_string(),
                ))
            }
        }
    };

    if !outbuffer.is_null() {
        libc::free(outbuffer as *mut c_void);
    }

    result
}
