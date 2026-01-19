use serde::Deserialize;
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Deserialize)]
struct EventsFile {
    events: Vec<EventSpec>,
}

#[derive(Deserialize)]
struct EventSpec {
    name: String,
    payload: BTreeMap<String, String>,
}

fn rust_variant(name: &str) -> String {
    let mut out = String::new();
    let mut upper = true;
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            if upper {
                out.extend(ch.to_uppercase());
                upper = false;
            } else {
                out.push(ch);
            }
        } else {
            upper = true;
        }
    }
    if out.is_empty() {
        "Event".to_string()
    } else {
        out
    }
}

fn rust_field(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "field".to_string()
    } else if out.chars().next().unwrap().is_ascii_digit() {
        format!("_{out}")
    } else {
        out
    }
}

fn rust_type(type_name: &str) -> Option<&'static str> {
    match type_name {
        "string" => Some("String"),
        "number" => Some("f64"),
        "boolean" => Some("bool"),
        "string[]" => Some("Vec<String>"),
        "number[]" => Some("Vec<f64>"),
        "boolean[]" => Some("Vec<bool>"),
        _ => None,
    }
}

fn split_optional(name: &str) -> (String, bool) {
    if let Some(stripped) = name.strip_suffix('?') {
        (stripped.to_string(), true)
    } else {
        (name.to_string(), false)
    }
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let events_path = manifest_dir.join("../../../packages/analytics-events/events.json");
    println!("cargo:rerun-if-changed={}", events_path.display());

    let events_json = fs::read_to_string(&events_path).unwrap();
    let events_file: EventsFile = serde_json::from_str(&events_json).unwrap();

    let mut out = String::new();
    out.push_str("pub const ANALYTICS_EVENT_NAMES: [&str; ");
    out.push_str(&events_file.events.len().to_string());
    out.push_str("] = [");
    for (idx, event) in events_file.events.iter().enumerate() {
        if idx > 0 {
            out.push_str(", ");
        }
        out.push('"');
        out.push_str(&event.name);
        out.push('"');
    }
    out.push_str("];\n\n");

    out.push_str("pub enum AnalyticsEventName {\n");
    for event in &events_file.events {
        let variant = rust_variant(&event.name);
        out.push_str("    ");
        out.push_str(&variant);
        out.push_str(",\n");
    }
    out.push_str("}\n\n");

    out.push_str("impl AnalyticsEventName {\n");
    out.push_str("    pub fn as_str(self) -> &'static str {\n");
    out.push_str("        match self {\n");
    for event in &events_file.events {
        let variant = rust_variant(&event.name);
        out.push_str("            Self::");
        out.push_str(&variant);
        out.push_str(" => \"");
        out.push_str(&event.name);
        out.push_str("\",\n");
    }
    out.push_str("        }\n");
    out.push_str("    }\n");
    out.push_str("}\n\n");

    for event in &events_file.events {
        let struct_name = format!("{}Payload", rust_variant(&event.name));
        out.push_str("#[derive(serde::Serialize, serde::Deserialize)]\n");
        out.push_str("pub struct ");
        out.push_str(&struct_name);
        out.push_str(" {\n");
        for (field, field_type) in &event.payload {
            let (field, optional) = split_optional(field);
            let rust_field = rust_field(&field);
            let rust_type = rust_type(field_type)
                .unwrap_or_else(|| panic!("unsupported type {}", field_type));
            out.push_str("    pub ");
            out.push_str(&rust_field);
            out.push_str(": ");
            if optional {
                out.push_str("Option<");
                out.push_str(rust_type);
                out.push('>');
            } else {
                out.push_str(rust_type);
            }
            out.push_str(",\n");
        }
        out.push_str("}\n\n");
    }

    out.push_str("pub enum AnalyticsEvent {\n");
    for event in &events_file.events {
        let variant = rust_variant(&event.name);
        let payload = format!("{}Payload", variant);
        out.push_str("    ");
        out.push_str(&variant);
        out.push_str("(");
        out.push_str(&payload);
        out.push_str("),\n");
    }
    out.push_str("}\n\n");

    out.push_str("impl AnalyticsEvent {\n");
    out.push_str("    pub fn name(&self) -> &'static str {\n");
    out.push_str("        match self {\n");
    for event in &events_file.events {
        let variant = rust_variant(&event.name);
        out.push_str("            Self::");
        out.push_str(&variant);
        out.push_str("(_) => \"");
        out.push_str(&event.name);
        out.push_str("\",\n");
    }
    out.push_str("        }\n");
    out.push_str("    }\n\n");

    out.push_str("    pub fn payload_json(&self) -> serde_json::Value {\n");
    out.push_str("        match self {\n");
    for event in &events_file.events {
        let variant = rust_variant(&event.name);
        out.push_str("            Self::");
        out.push_str(&variant);
        out.push_str("(payload) => serde_json::to_value(payload).unwrap(),\n");
    }
    out.push_str("        }\n");
    out.push_str("    }\n");
    out.push_str("}\n");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let out_file = out_dir.join("analytics_events.rs");
    fs::write(out_file, out).unwrap();

    tauri_build::build()
}
