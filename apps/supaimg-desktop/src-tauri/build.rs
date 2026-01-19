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
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let manifest_path = manifest_dir.join("../src/lib/tauri.manifest.ts");
    let lib_rs_path = manifest_dir.join("src/lib.rs");
    let schema_path = manifest_dir.join("../src/analytics/events.json");

    println!("cargo:rerun-if-changed={}", manifest_path.display());
    println!("cargo:rerun-if-changed={}", lib_rs_path.display());
    println!("cargo:rerun-if-changed={}", schema_path.display());

    if let Err(err) = validate_manifest(&manifest_path, &lib_rs_path) {
        panic!("{err}");
    }

    let schema_data = fs::read_to_string(&schema_path).expect("read analytics schema");
    let schema: AnalyticsSchema =
        serde_json::from_str(&schema_data).expect("parse analytics schema");
    validate_schema(&schema);

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let out_path = out_dir.join("analytics_events.rs");
    let generated = generate_module(&schema);
    fs::write(&out_path, generated).expect("write analytics_events.rs");

    tauri_build::build();
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

fn validate_manifest(manifest_path: &PathBuf, lib_rs_path: &PathBuf) -> Result<(), String> {
    let manifest = fs::read_to_string(manifest_path).map_err(|err| err.to_string())?;
    let lib_rs = fs::read_to_string(lib_rs_path).map_err(|err| err.to_string())?;

    let manifest_commands = extract_ts_array(&manifest, "COMMANDS")?;
    let manifest_events = extract_ts_array(&manifest, "EVENTS")?;
    ensure_unique("COMMANDS", &manifest_commands)?;
    ensure_unique("EVENTS", &manifest_events)?;

    let rust_commands = extract_rust_handlers(&lib_rs)?;
    let rust_events = extract_rust_events(&lib_rs)?;

    compare_sets("commands", &manifest_commands, &rust_commands)?;

    let manifest_events: Vec<String> = manifest_events
        .into_iter()
        .filter(|event| !event.starts_with("tauri://"))
        .collect();
    compare_sets("events", &manifest_events, &rust_events)?;

    Ok(())
}

fn extract_ts_array(source: &str, name: &str) -> Result<Vec<String>, String> {
    let marker = format!("export const {name}");
    let start = source
        .find(&marker)
        .ok_or_else(|| format!("{name} array not found"))?;
    let after = &source[start + marker.len()..];
    let open = after
        .find('[')
        .ok_or_else(|| format!("{name} array is missing opening bracket"))?;
    let after_open = &after[open + 1..];
    let end = after_open
        .find(']')
        .ok_or_else(|| format!("{name} array is missing closing bracket"))?;
    extract_string_literals(&after_open[..end])
}

fn extract_string_literals(source: &str) -> Result<Vec<String>, String> {
    let bytes = source.as_bytes();
    let mut values = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'"' {
            let (value, consumed) = parse_string_literal(&source[index + 1..])?;
            values.push(value);
            index += consumed + 2;
        } else {
            index += 1;
        }
    }
    Ok(values)
}

fn parse_string_literal(source: &str) -> Result<(String, usize), String> {
    let bytes = source.as_bytes();
    let mut value = String::new();
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => {
                if index + 1 >= bytes.len() {
                    return Err("unterminated escape sequence".to_string());
                }
                let escaped = bytes[index + 1] as char;
                let next = match escaped {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    '\\' => '\\',
                    '"' => '"',
                    other => other,
                };
                value.push(next);
                index += 2;
            }
            b'"' => return Ok((value, index)),
            other => {
                value.push(other as char);
                index += 1;
            }
        }
    }
    Err("unterminated string literal".to_string())
}

fn extract_rust_handlers(source: &str) -> Result<Vec<String>, String> {
    let needle = "tauri::generate_handler![";
    let start = source
        .find(needle)
        .ok_or_else(|| "generate_handler list not found".to_string())?;
    let after = &source[start + needle.len()..];
    let end = after
        .find(']')
        .ok_or_else(|| "generate_handler list missing closing bracket".to_string())?;
    let body = &after[..end];
    let mut handlers = Vec::new();
    for entry in body.split(',') {
        let value = entry.trim();
        if value.is_empty() {
            continue;
        }
        let name = value.rsplit("::").next().unwrap_or(value);
        handlers.push(name.to_string());
    }
    Ok(handlers)
}

fn extract_rust_events(source: &str) -> Result<Vec<String>, String> {
    let mut events = Vec::new();
    let mut index = 0;
    while let Some(offset) = source[index..].find(".emit(") {
        let start = index + offset + ".emit(".len();
        match extract_first_string_literal(&source[start..])? {
            Some((value, consumed)) => {
                events.push(value);
                index = start + consumed;
            }
            None => {
                index = start;
            }
        }
    }
    Ok(events)
}

fn extract_first_string_literal(source: &str) -> Result<Option<(String, usize)>, String> {
    let bytes = source.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'"' {
            let (value, consumed) = parse_string_literal(&source[index + 1..])?;
            return Ok(Some((value, index + consumed + 2)));
        }
        if bytes[index] == b')' {
            return Ok(None);
        }
        index += 1;
    }
    Ok(None)
}

fn ensure_unique(label: &str, items: &[String]) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    let mut duplicates = Vec::new();
    for item in items {
        if !seen.insert(item) {
            duplicates.push(item.clone());
        }
    }
    if duplicates.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "{label} contains duplicate entries: {}",
            join_list(&duplicates)
        ))
    }
}

fn compare_sets(label: &str, manifest: &[String], rust: &[String]) -> Result<(), String> {
    let manifest_set: BTreeSet<_> = manifest.iter().cloned().collect();
    let rust_set: BTreeSet<_> = rust.iter().cloned().collect();
    if manifest_set == rust_set {
        return Ok(());
    }
    let missing: Vec<_> = rust_set.difference(&manifest_set).cloned().collect();
    let extra: Vec<_> = manifest_set.difference(&rust_set).cloned().collect();
    let mut message = format!("Tauri manifest {label} mismatch");
    if !missing.is_empty() {
        message.push_str(&format!("\nmissing in manifest: {}", join_list(&missing)));
    }
    if !extra.is_empty() {
        message.push_str(&format!("\nextra in manifest: {}", join_list(&extra)));
    }
    Err(message)
}

fn join_list(items: &[String]) -> String {
    items.join(", ")
}
