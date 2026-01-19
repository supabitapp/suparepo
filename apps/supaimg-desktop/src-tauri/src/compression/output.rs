use std::ffi::OsString;
use std::path::{Path, PathBuf};
use tempfile::TempPath;

pub fn output_path_with_suffix(
    path: &Path,
    suffix: &str,
    extension_override: Option<&str>,
) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .unwrap_or(path.as_os_str())
        .to_string_lossy();

    let name = if let Some(at_pos) = stem.rfind('@') {
        let at_suffix = &stem[at_pos..];
        if at_suffix.chars().nth(1).is_some_and(|c| c.is_ascii_digit()) {
            format!("{}_{}{}", &stem[..at_pos], suffix, at_suffix)
        } else {
            format!("{stem}_{suffix}")
        }
    } else {
        format!("{stem}_{suffix}")
    };

    let mut result = OsString::from(name);
    if let Some(ext) = extension_override.or_else(|| path.extension().and_then(|ext| ext.to_str()))
    {
        result.push(".");
        result.push(ext);
    }
    parent.join(result)
}

pub fn compressed_output_path(path: &Path) -> PathBuf {
    output_path_with_suffix(path, "compressed", None)
}

pub fn converted_output_path(path: &Path) -> PathBuf {
    output_path_with_suffix(path, "converted", Some("jpg"))
}

pub fn is_output_path(path: &Path, suffix: &str) -> bool {
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let dot_index = filename.rfind('.').unwrap_or(filename.len());
    let stem = filename[..dot_index].to_lowercase();
    let tag = format!("_{suffix}");

    if stem.ends_with(&tag) {
        return true;
    }

    let at_pos = match stem.rfind('@') {
        Some(pos) => pos,
        None => return false,
    };
    let before = &stem[..at_pos];
    let after = &stem[at_pos + 1..];
    before.ends_with(&tag) && is_retina_suffix(after)
}

pub fn temp_path_for_output(path: &Path) -> std::io::Result<TempPath> {
    let dir = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let temp = tempfile::Builder::new()
        .prefix(".compress_tmp_")
        .tempfile_in(dir)?;
    Ok(temp.into_temp_path())
}

fn is_retina_suffix(value: &str) -> bool {
    if !value.ends_with('x') {
        return false;
    }
    let digits = &value[..value.len().saturating_sub(1)];
    !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::{output_path_with_extension, Workflow};
    use serde::Deserialize;

    #[test]
    fn basic_filename() {
        assert_eq!(
            compressed_output_path(Path::new("image.png")),
            PathBuf::from("image_compressed.png")
        );
    }

    #[test]
    fn with_directory() {
        assert_eq!(
            compressed_output_path(Path::new("/path/to/image.jpg")),
            PathBuf::from("/path/to/image_compressed.jpg")
        );
    }

    #[test]
    fn retina_2x() {
        assert_eq!(
            compressed_output_path(Path::new("icon@2x.png")),
            PathBuf::from("icon_compressed@2x.png")
        );
    }

    #[test]
    fn retina_3x() {
        assert_eq!(
            compressed_output_path(Path::new("icon@3x.png")),
            PathBuf::from("icon_compressed@3x.png")
        );
    }

    #[test]
    fn retina_1x() {
        assert_eq!(
            compressed_output_path(Path::new("icon@1x.png")),
            PathBuf::from("icon_compressed@1x.png")
        );
    }

    #[test]
    fn retina_with_dimensions() {
        assert_eq!(
            compressed_output_path(Path::new("128x128@2x.png")),
            PathBuf::from("128x128_compressed@2x.png")
        );
    }

    #[test]
    fn retina_with_full_path() {
        assert_eq!(
            compressed_output_path(Path::new("/icons/128x128@2x.png")),
            PathBuf::from("/icons/128x128_compressed@2x.png")
        );
    }

    #[test]
    fn at_symbol_not_retina() {
        assert_eq!(
            compressed_output_path(Path::new("user@email.png")),
            PathBuf::from("user@email_compressed.png")
        );
    }

    #[test]
    fn at_symbol_at_end() {
        assert_eq!(
            compressed_output_path(Path::new("test@.png")),
            PathBuf::from("test@_compressed.png")
        );
    }

    #[test]
    fn multiple_at_symbols() {
        assert_eq!(
            compressed_output_path(Path::new("foo@bar@2x.png")),
            PathBuf::from("foo@bar_compressed@2x.png")
        );
    }

    #[test]
    fn no_extension() {
        assert_eq!(
            compressed_output_path(Path::new("image")),
            PathBuf::from("image_compressed")
        );
    }

    #[test]
    fn no_extension_retina() {
        assert_eq!(
            compressed_output_path(Path::new("icon@2x")),
            PathBuf::from("icon_compressed@2x")
        );
    }

    #[test]
    fn multiple_dots() {
        assert_eq!(
            compressed_output_path(Path::new("archive.tar.gz")),
            PathBuf::from("archive.tar_compressed.gz")
        );
    }

    #[test]
    fn hidden_file() {
        assert_eq!(
            compressed_output_path(Path::new(".hidden.png")),
            PathBuf::from(".hidden_compressed.png")
        );
    }

    #[test]
    fn webp_extension() {
        assert_eq!(
            compressed_output_path(Path::new("photo.webp")),
            PathBuf::from("photo_compressed.webp")
        );
    }

    #[test]
    fn jpeg_extension() {
        assert_eq!(
            compressed_output_path(Path::new("photo.jpeg")),
            PathBuf::from("photo_compressed.jpeg")
        );
    }

    #[test]
    fn converted_extension() {
        assert_eq!(
            converted_output_path(Path::new("photo.png")),
            PathBuf::from("photo_converted.jpg")
        );
    }

    #[test]
    fn output_suffix_detection() {
        assert!(is_output_path(
            Path::new("/path/file_compressed.png"),
            "compressed"
        ));
        assert!(is_output_path(
            Path::new("/path/file_converted@2x.jpg"),
            "converted"
        ));
        assert!(!is_output_path(Path::new("/path/file.png"), "compressed"));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct OutputFixture {
        path: String,
        workflow: Workflow,
        output: String,
        extension_override: Option<String>,
    }

    #[test]
    fn output_path_fixtures_match() {
        let raw = include_str!("../../../output-path-fixtures.json");
        let fixtures: Vec<OutputFixture> =
            serde_json::from_str(raw).expect("output-path-fixtures.json invalid");
        for fixture in fixtures {
            let result = output_path_with_extension(
                Path::new(&fixture.path),
                fixture.workflow,
                fixture.extension_override.as_deref(),
            );
            assert_eq!(result.to_string_lossy(), fixture.output);
        }
    }
}
