use serde::{Deserialize, Serialize};
#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum ConvertOutputFormat {
  #[serde(rename = "jpeg")]
  Jpeg,
  #[serde(rename = "png")]
  Png,
  #[serde(rename = "webp")]
  Webp,
  #[serde(rename = "gif")]
  Gif
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum RemoveBgOutputFormat {
  #[serde(rename = "png")]
  Png,
  #[serde(rename = "webp")]
  Webp
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum BlurMode {
  #[serde(rename = "pixelate")]
  Pixelate,
  #[serde(rename = "gaussian")]
  Gaussian,
  #[serde(rename = "solid")]
  Solid
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Settings {
  #[serde(rename = "workflowSettings")]
  #[serde(default)]
  pub workflow_settings: WorkflowSettings,
  #[serde(rename = "launchAtLogin")]
  #[serde(default = "default_launch_at_login")]
  pub launch_at_login: bool,
  #[serde(rename = "showMenuBarIcon")]
  #[serde(default = "default_show_menu_bar_icon")]
  pub show_menu_bar_icon: bool,
  #[serde(rename = "autoUpdate")]
  #[serde(default = "default_auto_update")]
  pub auto_update: bool,
  #[serde(rename = "analyticsTracking")]
  #[serde(default = "default_analytics_tracking")]
  pub analytics_tracking: bool,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowSettings {
  #[serde(default)]
  pub compress: CompressSettings,
  #[serde(default)]
  pub convert: ConvertSettings,
  #[serde(default)]
  pub remove_bg: RemoveBgSettings,
  #[serde(default)]
  pub blur_text: BlurTextSettings,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct CompressSettings {
  #[serde(rename = "overrideOriginal")]
  #[serde(default = "default_workflow_settings_compress_override_original")]
  pub override_original: bool,
  #[serde(rename = "stripPngMetadata")]
  #[serde(default = "default_workflow_settings_compress_strip_png_metadata")]
  pub strip_png_metadata: bool,
  #[serde(rename = "stripJpegMetadata")]
  #[serde(default = "default_workflow_settings_compress_strip_jpeg_metadata")]
  pub strip_jpeg_metadata: bool,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct ConvertSettings {
  #[serde(rename = "outputFormat")]
  #[serde(default = "default_workflow_settings_convert_output_format")]
  pub output_format: ConvertOutputFormat,
  #[serde(rename = "jpegQuality")]
  #[serde(default = "default_workflow_settings_convert_jpeg_quality")]
  pub jpeg_quality: u32,
  #[serde(rename = "pngCompressionLevel")]
  #[serde(default = "default_workflow_settings_convert_png_compression_level")]
  pub png_compression_level: u32,
  #[serde(rename = "webpQuality")]
  #[serde(default = "default_workflow_settings_convert_webp_quality")]
  pub webp_quality: u32,
  #[serde(rename = "webpLossless")]
  #[serde(default = "default_workflow_settings_convert_webp_lossless")]
  pub webp_lossless: bool,
  #[serde(rename = "gifColors")]
  #[serde(default = "default_workflow_settings_convert_gif_colors")]
  pub gif_colors: u32,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct RemoveBgSettings {
  #[serde(rename = "outputFormat")]
  #[serde(default = "default_workflow_settings_remove_bg_output_format")]
  pub output_format: RemoveBgOutputFormat,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct BlurTextSettings {
  #[serde(rename = "overrideOriginal")]
  #[serde(default = "default_workflow_settings_blur_text_override_original")]
  pub override_original: bool,
  #[serde(rename = "blurMode")]
  #[serde(default = "default_workflow_settings_blur_text_blur_mode")]
  pub blur_mode: BlurMode,
  #[serde(rename = "blurStrength")]
  #[serde(default = "default_workflow_settings_blur_text_blur_strength")]
  pub blur_strength: u32,
  #[serde(default = "default_workflow_settings_blur_text_padding")]
  pub padding: u32,
  #[serde(rename = "confidenceThreshold")]
  #[serde(default = "default_workflow_settings_blur_text_confidence_threshold")]
  pub confidence_threshold: f64,
  #[serde(rename = "minBoxSize")]
  #[serde(default = "default_workflow_settings_blur_text_min_box_size")]
  pub min_box_size: u32,
}

impl Default for Settings {
  fn default() -> Self {
    Self {
      workflow_settings: WorkflowSettings::default(),
      launch_at_login: default_launch_at_login(),
      show_menu_bar_icon: default_show_menu_bar_icon(),
      auto_update: default_auto_update(),
      analytics_tracking: default_analytics_tracking(),
    }
  }
}

impl Default for WorkflowSettings {
  fn default() -> Self {
    Self {
      compress: CompressSettings::default(),
      convert: ConvertSettings::default(),
      remove_bg: RemoveBgSettings::default(),
      blur_text: BlurTextSettings::default(),
    }
  }
}

impl Default for CompressSettings {
  fn default() -> Self {
    Self {
      override_original: default_workflow_settings_compress_override_original(),
      strip_png_metadata: default_workflow_settings_compress_strip_png_metadata(),
      strip_jpeg_metadata: default_workflow_settings_compress_strip_jpeg_metadata(),
    }
  }
}

impl Default for ConvertSettings {
  fn default() -> Self {
    Self {
      output_format: default_workflow_settings_convert_output_format(),
      jpeg_quality: default_workflow_settings_convert_jpeg_quality(),
      png_compression_level: default_workflow_settings_convert_png_compression_level(),
      webp_quality: default_workflow_settings_convert_webp_quality(),
      webp_lossless: default_workflow_settings_convert_webp_lossless(),
      gif_colors: default_workflow_settings_convert_gif_colors(),
    }
  }
}

impl Default for RemoveBgSettings {
  fn default() -> Self {
    Self {
      output_format: default_workflow_settings_remove_bg_output_format(),
    }
  }
}

impl Default for BlurTextSettings {
  fn default() -> Self {
    Self {
      override_original: default_workflow_settings_blur_text_override_original(),
      blur_mode: default_workflow_settings_blur_text_blur_mode(),
      blur_strength: default_workflow_settings_blur_text_blur_strength(),
      padding: default_workflow_settings_blur_text_padding(),
      confidence_threshold: default_workflow_settings_blur_text_confidence_threshold(),
      min_box_size: default_workflow_settings_blur_text_min_box_size(),
    }
  }
}

impl Settings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.workflow_settings = value.workflow_settings.normalize();
    value
  }
}

impl WorkflowSettings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.compress = value.compress.normalize();
    value.convert = value.convert.normalize();
    value.remove_bg = value.remove_bg.normalize();
    value.blur_text = value.blur_text.normalize();
    value
  }
}

impl CompressSettings {
  pub fn normalize(self) -> Self {
    self
  }
}

impl ConvertSettings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.jpeg_quality = value.jpeg_quality.clamp(60, 100);
    value.png_compression_level = value.png_compression_level.clamp(1, 9);
    value.webp_quality = value.webp_quality.clamp(60, 100);
    value.gif_colors = value.gif_colors.clamp(2, 256);
    value
  }
}

impl RemoveBgSettings {
  pub fn normalize(self) -> Self {
    self
  }
}

impl BlurTextSettings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.blur_strength = value.blur_strength.clamp(2, 40);
    value.padding = value.padding.clamp(0, 24);
    value.confidence_threshold = value.confidence_threshold.clamp(0.3f64, 0.9f64);
    value.min_box_size = value.min_box_size.clamp(4, 64);
    value
  }
}

impl Settings {
  pub fn defaults() -> Self {
    Self::default()
  }

  pub fn from_json(value: &str) -> Result<Self, serde_json::Error> {
    serde_json::from_str(value).map(Self::normalize)
  }
}

fn default_workflow_settings_compress_override_original() -> bool {
  false
}

fn default_workflow_settings_compress_strip_png_metadata() -> bool {
  true
}

fn default_workflow_settings_compress_strip_jpeg_metadata() -> bool {
  true
}

fn default_workflow_settings_convert_output_format() -> ConvertOutputFormat {
  ConvertOutputFormat::Jpeg
}

fn default_workflow_settings_convert_jpeg_quality() -> u32 {
  100
}

fn default_workflow_settings_convert_png_compression_level() -> u32 {
  6
}

fn default_workflow_settings_convert_webp_quality() -> u32 {
  100
}

fn default_workflow_settings_convert_webp_lossless() -> bool {
  true
}

fn default_workflow_settings_convert_gif_colors() -> u32 {
  256
}

fn default_workflow_settings_remove_bg_output_format() -> RemoveBgOutputFormat {
  RemoveBgOutputFormat::Png
}

fn default_workflow_settings_blur_text_override_original() -> bool {
  false
}

fn default_workflow_settings_blur_text_blur_mode() -> BlurMode {
  BlurMode::Gaussian
}

fn default_workflow_settings_blur_text_blur_strength() -> u32 {
  12
}

fn default_workflow_settings_blur_text_padding() -> u32 {
  6
}

fn default_workflow_settings_blur_text_confidence_threshold() -> f64 {
  0.6
}

fn default_workflow_settings_blur_text_min_box_size() -> u32 {
  8
}

fn default_launch_at_login() -> bool {
  false
}

fn default_show_menu_bar_icon() -> bool {
  true
}

fn default_auto_update() -> bool {
  true
}

fn default_analytics_tracking() -> bool {
  true
}

#[cfg(test)]
mod tests {
  use super::Settings;

  #[test]
  fn defaults_match_schema() {
    let json = include_str!("../../../../packages/settings/settings.defaults.json");
    let defaults: Settings = serde_json::from_str(json).unwrap();
    assert!(defaults == Settings::defaults());
  }
}
