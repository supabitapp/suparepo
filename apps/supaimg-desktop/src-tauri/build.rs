use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Deserialize)]
struct AnalyticsSchema {
    #[serde(rename = "propertyTypes")]
    property_types: BTreeMap<String, String>,
    events: BTreeMap<String, AnalyticsEventDefinition>,
    #[serde(rename = "workflowProperties")]
    workflow_properties: BTreeMap<String, Vec<String>>,
}

#[derive(Deserialize)]
struct AnalyticsEventDefinition {
    required: Vec<String>,
    optional: Vec<String>,
}

fn main() {
    tauri_build::build();

    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let schema_path = PathBuf::from(manifest_dir).join("../src/analytics/events.json");
    println!("cargo:rerun-if-changed={}", schema_path.display());

    let schema_data = fs::read_to_string(&schema_path).expect("read analytics schema");
    let schema: AnalyticsSchema =
        serde_json::from_str(&schema_data).expect("parse analytics schema");
    validate_schema(&schema);

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let out_path = out_dir.join("analytics_events.rs");
    let generated = generate_module(&schema);
    fs::write(&out_path, generated).expect("write analytics_events.rs");
}

fn validate_schema(schema: &AnalyticsSchema) {
    for (event_name, definition) in &schema.events {
        let mut seen = BTreeSet::new();
        for property in definition.required.iter().chain(definition.optional.iter()) {
            if !schema.property_types.contains_key(property) {
                panic!("missing property type for {event_name}.{property}");
            }
            if !seen.insert(property) {
                panic!("duplicate property {event_name}.{property}");
            }
        }
    }

    for (workflow_name, properties) in &schema.workflow_properties {
        let mut seen = BTreeSet::new();
        for property in properties {
            if !schema.property_types.contains_key(property) {
                panic!("missing property type for workflow {workflow_name}.{property}");
            }
            if !seen.insert(property) {
                panic!("duplicate workflow property {workflow_name}.{property}");
            }
        }
    }
}

fn generate_module(schema: &AnalyticsSchema) -> String {
    let mut out = String::new();
    out.push_str("pub struct EventDefinition { pub name: &'static str, pub required: &'static [&'static str], pub optional: &'static [&'static str] }\n");
    out.push_str("pub struct WorkflowDefinition { pub name: &'static str, pub properties: &'static [&'static str] }\n");

    for event_name in schema.events.keys() {
        let const_name = to_const_name(event_name);
        out.push_str(&format!(
            "pub const {const_name}: &str = \"{event_name}\";\n"
        ));
    }

    out.push_str("pub const EVENT_DEFINITIONS: &[EventDefinition] = &[\n");
    for (event_name, definition) in &schema.events {
        let const_name = to_const_name(event_name);
        out.push_str("    EventDefinition { name: ");
        out.push_str(&const_name);
        out.push_str(", required: ");
        out.push_str(&format_slice(&definition.required));
        out.push_str(", optional: ");
        out.push_str(&format_slice(&definition.optional));
        out.push_str(" },\n");
    }
    out.push_str("];\n");

    out.push_str("pub const WORKFLOW_DEFINITIONS: &[WorkflowDefinition] = &[\n");
    for (workflow_name, properties) in &schema.workflow_properties {
        out.push_str("    WorkflowDefinition { name: \"");
        out.push_str(workflow_name);
        out.push_str("\", properties: ");
        out.push_str(&format_slice(properties));
        out.push_str(" },\n");
    }
    out.push_str("];\n");

    out.push_str("pub fn event_definition(name: &str) -> Option<&'static EventDefinition> { EVENT_DEFINITIONS.iter().find(|def| def.name == name) }\n");
    out.push_str("pub fn workflow_definition(name: &str) -> Option<&'static WorkflowDefinition> { WORKFLOW_DEFINITIONS.iter().find(|def| def.name == name) }\n");
    out
}

fn format_slice(values: &[String]) -> String {
    let mut out = String::from("&[");
    for (index, value) in values.iter().enumerate() {
        if index > 0 {
            out.push_str(", ");
        }
        out.push('"');
        out.push_str(value);
        out.push('"');
    }
    out.push(']');
    out
}

fn to_const_name(name: &str) -> String {
    name.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect()
}
