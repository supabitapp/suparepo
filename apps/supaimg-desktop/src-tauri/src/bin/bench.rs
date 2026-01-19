use compress_lib::background_removal;
use compress_lib::compression::output::{compressed_output_path, output_path_with_suffix};
use compress_lib::compression::{compress_auto, compress_path, CompressionOptions, ImageFormat};
use compress_lib::generated::workflow_settings::{
    BLUR_TEXT_BLUR_MODE_DEFAULT, BLUR_TEXT_BLUR_STRENGTH_DEFAULT,
    BLUR_TEXT_CONFIDENCE_THRESHOLD_DEFAULT, BLUR_TEXT_MIN_BOX_SIZE_DEFAULT,
    BLUR_TEXT_OVERRIDE_ORIGINAL_DEFAULT, BLUR_TEXT_PADDING_DEFAULT,
};
use compress_lib::onnx_runtime;
use compress_lib::text_blur;
use compress_lib::BlurTextOptions;
use std::error::Error;
use std::path::Path;

fn print_usage() {
    eprintln!(
        "Usage: bench [--no-write] [--remove-bg] [--blur-text] <files...>\n\
Example: cargo run -p compress --bin bench -- ./images/*.png",
    );
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = std::env::args().skip(1);
    let mut write_output = true;
    let mut remove_bg = false;
    let mut blur_text = false;
    let mut paths = Vec::new();
    let options = CompressionOptions {
        strip_png_metadata: true,
        strip_jpeg_metadata: true,
        png_compression_level: 2,
        webp_lossless: true,
        webp_quality: 75,
    };

    for arg in args {
        match arg.as_str() {
            "--no-write" => {
                write_output = false;
            }
            "--remove-bg" => {
                remove_bg = true;
            }
            "--blur-text" => {
                blur_text = true;
            }
            "--help" | "-h" => {
                print_usage();
                return Ok(());
            }
            _ => paths.push(arg),
        }
    }

    if remove_bg && blur_text {
        print_usage();
        return Err("choose only one of --remove-bg or --blur-text".into());
    }

    if paths.is_empty() {
        print_usage();
        return Err("no files provided".into());
    }

    if remove_bg {
        let model_path = background_removal::resolve_model_path_cli()?;
        let onnxruntime_path = onnx_runtime::resolve_onnxruntime_path_cli()?;
        for path in &paths {
            let output_path = output_path_with_suffix(Path::new(path), "nobg", Some("png"));
            if write_output {
                match background_removal::remove_background_with_progress_paths(
                    Path::new(path),
                    &output_path,
                    ImageFormat::Png,
                    &model_path,
                    &onnxruntime_path,
                    |_| {},
                ) {
                    Ok(output) => println!(
                        "remove-bg {} -> {} ({} -> {})",
                        path,
                        output_path.display(),
                        output.original_size,
                        output.output_size
                    ),
                    Err(e) => eprintln!("skipped {} ({})", path, e),
                }
            } else {
                let temp_dir = tempfile::tempdir()?;
                let temp_path = temp_dir.path().join("nobg.png");
                match background_removal::remove_background_with_progress_paths(
                    Path::new(path),
                    &temp_path,
                    ImageFormat::Png,
                    &model_path,
                    &onnxruntime_path,
                    |_| {},
                ) {
                    Ok(output) => println!(
                        "remove-bg {} ({} -> {}) [no-write]",
                        path, output.original_size, output.output_size
                    ),
                    Err(e) => eprintln!("skipped {} ({})", path, e),
                }
            }
        }
        return Ok(());
    }

    if blur_text {
        let model_path = text_blur::resolve_model_path_cli()?;
        let onnxruntime_path = onnx_runtime::resolve_onnxruntime_path_cli()?;
        let options = BlurTextOptions {
            override_original: BLUR_TEXT_OVERRIDE_ORIGINAL_DEFAULT,
            blur_mode: BLUR_TEXT_BLUR_MODE_DEFAULT,
            blur_strength: BLUR_TEXT_BLUR_STRENGTH_DEFAULT,
            padding: BLUR_TEXT_PADDING_DEFAULT,
            confidence_threshold: BLUR_TEXT_CONFIDENCE_THRESHOLD_DEFAULT,
            min_box_size: BLUR_TEXT_MIN_BOX_SIZE_DEFAULT,
        };
        for path in &paths {
            let output_path = output_path_with_suffix(Path::new(path), "blurred", None);
            if write_output {
                match text_blur::blur_text_with_progress_paths(
                    Path::new(path),
                    &output_path,
                    &options,
                    &model_path,
                    &onnxruntime_path,
                    |_| {},
                ) {
                    Ok(output) => println!(
                        "blur-text {} -> {} ({} -> {})",
                        path,
                        output_path.display(),
                        output.original_size,
                        output.output_size
                    ),
                    Err(e) => eprintln!("skipped {} ({})", path, e),
                }
            } else {
                let temp_dir = tempfile::tempdir()?;
                let temp_path = temp_dir.path().join("blurred");
                match text_blur::blur_text_with_progress_paths(
                    Path::new(path),
                    &temp_path,
                    &options,
                    &model_path,
                    &onnxruntime_path,
                    |_| {},
                ) {
                    Ok(output) => println!(
                        "blur-text {} ({} -> {}) [no-write]",
                        path, output.original_size, output.output_size
                    ),
                    Err(e) => eprintln!("skipped {} ({})", path, e),
                }
            }
        }
        return Ok(());
    }

    for path in paths {
        if write_output {
            let output_path = compressed_output_path(Path::new(&path));
            match compress_path(Path::new(&path), &output_path, options) {
                Ok(output) => println!(
                    "compressed {} -> {} ({} -> {})",
                    path,
                    output_path.display(),
                    output.original_size,
                    output.output_size
                ),
                Err(e) => eprintln!("skipped {} ({})", path, e),
            }
        } else {
            let data = match std::fs::read(&path) {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("skipped {} ({})", path, e);
                    continue;
                }
            };
            match compress_auto(data, options) {
                Ok(output) => println!(
                    "compressed {} ({} -> {}) [no-write]",
                    path, output.result.original_size, output.result.output_size
                ),
                Err(e) => eprintln!("skipped {} ({})", path, e),
            }
        }
    }

    Ok(())
}
