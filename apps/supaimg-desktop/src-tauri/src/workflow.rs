use crate::compression::output;
pub use crate::workflow_generated::{workflow_from_str, workflow_label, Workflow, WorkflowTask};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkflowConfigJson {
    id: String,
    input_extensions: Vec<String>,
    output_suffix: String,
    output_extension: Option<String>,
    task: WorkflowTask,
}

#[derive(Debug, Clone)]
pub struct WorkflowConfig {
    pub output_suffix: String,
    pub output_extension: Option<String>,
    pub input_extensions: Vec<String>,
    pub task: WorkflowTask,
}

fn workflow_configs() -> &'static HashMap<Workflow, WorkflowConfig> {
    static WORKFLOWS: OnceLock<HashMap<Workflow, WorkflowConfig>> = OnceLock::new();
    WORKFLOWS.get_or_init(|| {
        let raw = include_str!("../../workflows.json");
        let data: serde_json::Value = serde_json::from_str(raw).expect("workflows.json invalid");
        let items = data
            .get("workflows")
            .and_then(|value| value.as_array())
            .expect("workflows.json missing workflows");
        let mut map = HashMap::new();
        for item in items {
            let json: WorkflowConfigJson =
                serde_json::from_value(item.clone()).expect("workflow entry invalid");
            let Some(workflow) = workflow_from_str(&json.id) else {
                continue;
            };
            map.insert(
                workflow,
                WorkflowConfig {
                    output_suffix: json.output_suffix,
                    output_extension: json.output_extension,
                    input_extensions: json.input_extensions,
                    task: json.task,
                },
            );
        }
        map
    })
}

pub fn workflow_config(workflow: Workflow) -> &'static WorkflowConfig {
    workflow_configs()
        .get(&workflow)
        .expect("workflow config missing")
}

pub fn output_path_with_extension(
    path: &Path,
    workflow: Workflow,
    extension_override: Option<&str>,
) -> PathBuf {
    let config = workflow_config(workflow);
    output::output_path_with_suffix(
        path,
        &config.output_suffix,
        extension_override.or(config.output_extension.as_deref()),
    )
}

pub fn output_path(path: &Path, workflow: Workflow) -> PathBuf {
    output_path_with_extension(path, workflow, None)
}

pub fn is_supported_extension(ext: &str, workflow: Workflow) -> bool {
    let normalized = ext.to_lowercase();
    workflow_config(workflow)
        .input_extensions
        .contains(&normalized)
}
