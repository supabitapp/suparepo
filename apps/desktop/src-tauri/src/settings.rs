use serde::{Deserialize, Serialize};
#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum AppearanceTheme {
  #[serde(rename = "system")]
  System,
  #[serde(rename = "light")]
  Light,
  #[serde(rename = "dark")]
  Dark
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum BlurMode {
  #[serde(rename = "pixelate")]
  Pixelate,
  #[serde(rename = "gaussian")]
  Gaussian
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub enum OutputFormat {
  #[serde(rename = "png")]
  Png,
  #[serde(rename = "jpg")]
  Jpg,
  #[serde(rename = "webp")]
  Webp
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Settings {
  #[serde(default)]
  pub appearance: AppearanceSettings,
  #[serde(default)]
  pub blur: BlurSettings,
  #[serde(default)]
  pub output: OutputSettings,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct AppearanceSettings {
  #[serde(default = "default_appearance_theme")]
  pub theme: AppearanceTheme,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct BlurSettings {
  #[serde(default = "default_blur_mode")]
  pub mode: BlurMode,
  #[serde(default = "default_blur_radius")]
  pub radius: u32,
}

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct OutputSettings {
  #[serde(default = "default_output_format")]
  pub format: OutputFormat,
  #[serde(default = "default_output_quality")]
  pub quality: u32,
}

impl Default for Settings {
  fn default() -> Self {
    Self {
      appearance: AppearanceSettings::default(),
      blur: BlurSettings::default(),
      output: OutputSettings::default(),
    }
  }
}

impl Default for AppearanceSettings {
  fn default() -> Self {
    Self {
      theme: default_appearance_theme(),
    }
  }
}

impl Default for BlurSettings {
  fn default() -> Self {
    Self {
      mode: default_blur_mode(),
      radius: default_blur_radius(),
    }
  }
}

impl Default for OutputSettings {
  fn default() -> Self {
    Self {
      format: default_output_format(),
      quality: default_output_quality(),
    }
  }
}

impl Settings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.appearance = value.appearance.normalize();
    value.blur = value.blur.normalize();
    value.output = value.output.normalize();
    value
  }
}

impl AppearanceSettings {
  pub fn normalize(self) -> Self {
    self
  }
}

impl BlurSettings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.radius = value.radius.clamp(1, 64);
    value
  }
}

impl OutputSettings {
  pub fn normalize(self) -> Self {
    let mut value = self;
    value.quality = value.quality.clamp(1, 100);
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

fn default_appearance_theme() -> AppearanceTheme {
  AppearanceTheme::System
}

fn default_blur_mode() -> BlurMode {
  BlurMode::Pixelate
}

fn default_blur_radius() -> u32 {
  16
}

fn default_output_format() -> OutputFormat {
  OutputFormat::Png
}

fn default_output_quality() -> u32 {
  85
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
