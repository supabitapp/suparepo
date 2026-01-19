use serde::{Deserialize, Serialize};

#[derive(Debug, Copy, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Workflow {
    Compress,
    Convert,
    RemoveBg,
    BlurText,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowTask {
    Compress,
    Convert,
    RemoveBg,
    BlurText,
}

pub fn workflow_from_str(value: &str) -> Option<Workflow> {
    match value {
        "compress" => Some(Workflow::Compress),
        "convert" => Some(Workflow::Convert),
        "remove_bg" => Some(Workflow::RemoveBg),
        "blur_text" => Some(Workflow::BlurText),
        _ => None,
    }
}

pub fn workflow_label(value: Workflow) -> &'static str {
    match value {
        Workflow::Compress => "compress",
        Workflow::Convert => "convert",
        Workflow::RemoveBg => "remove_bg",
        Workflow::BlurText => "blur_text",
    }
}
