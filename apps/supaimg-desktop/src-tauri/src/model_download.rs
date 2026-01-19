use crate::compression::CompressionError;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use tempfile::NamedTempFile;

pub fn download_file<F: FnMut(f64)>(
    url: &str,
    destination: &Path,
    mut on_progress: F,
) -> Result<(), CompressionError> {
    if destination.exists() {
        return Ok(());
    }
    let parent = destination
        .parent()
        .ok_or_else(|| CompressionError::TaskFailed("invalid download path".to_string()))?;
    fs::create_dir_all(parent)?;
    let response =
        reqwest::blocking::get(url).map_err(|err| CompressionError::TaskFailed(err.to_string()))?;
    if !response.status().is_success() {
        return Err(CompressionError::TaskFailed(format!(
            "download failed: {}",
            response.status()
        )));
    }
    let total = response.content_length();
    let mut reader = response;
    let mut temp = NamedTempFile::new_in(parent)?;
    let mut buf = [0u8; 1024 * 64];
    let mut downloaded = 0u64;
    loop {
        let read = reader.read(&mut buf)?;
        if read == 0 {
            break;
        }
        temp.write_all(&buf[..read])?;
        downloaded += read as u64;
        if let Some(total) = total {
            let value = (downloaded as f64 / total as f64).min(1.0);
            on_progress(value);
        }
    }
    temp.flush()?;
    temp.persist(destination)
        .map_err(|err| CompressionError::IoError(err.to_string()))?;
    if total.is_none() {
        on_progress(1.0);
    }
    Ok(())
}
