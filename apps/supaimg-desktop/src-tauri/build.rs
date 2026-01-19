use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_path =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("tauri.manifest.json");
    println!("cargo:rerun-if-changed={}", manifest_path.display());

    let manifest_str = fs::read_to_string(&manifest_path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&manifest_str).unwrap();
    let commands = read_list(&value, "commands");
    let events = read_list(&value, "events");

    let rust_code = render_rust(&commands, &events);
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    fs::write(out_dir.join("tauri_manifest.rs"), rust_code).unwrap();

    let ts_path =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../src/tauri.manifest.ts");
    println!("cargo:rerun-if-changed={}", ts_path.display());
    let ts_code = render_ts(&commands, &events);
    let ts_changed = write_if_changed(&ts_path, &ts_code);
    if ts_changed {
        panic!("tauri.manifest.ts was updated; rerun the build");
    }

    tauri_build::build()
}

fn read_list(value: &serde_json::Value, key: &str) -> Vec<String> {
    let list = value
        .get(key)
        .and_then(|v| v.as_array())
        .unwrap_or_else(|| panic!("tauri.manifest.json missing {key}"));
    list.iter()
        .map(|v| {
            v.as_str()
                .unwrap_or_else(|| panic!("tauri.manifest.json {key} entry must be string"))
                .to_string()
        })
        .collect()
}

fn render_rust(commands: &[String], events: &[String]) -> String {
    let mut seen = std::collections::HashSet::new();
    for command in commands {
        if !is_rust_ident(command) {
            panic!("tauri.manifest.json command must be a valid Rust identifier");
        }
        if !seen.insert(command) {
            panic!("tauri.manifest.json command must be unique");
        }
    }

    let commands_array = format!("&{}", render_string_array(commands));
    let events_array = format!("&{}", render_string_array(events));
    let handler = if commands.is_empty() {
        "tauri::generate_handler![]".to_string()
    } else {
        format!("tauri::generate_handler![{}]", commands.join(", "))
    };

    format!(
        "pub const COMMANDS: &[&str] = {commands_array};\n\
pub const EVENTS: &[&str] = {events_array};\n\
\n\
pub fn invoke_handler() -> tauri::InvokeHandler {{\n    {handler}\n}}\n"
    )
}

fn render_ts(commands: &[String], events: &[String]) -> String {
    let commands_array = render_string_array(commands);
    let events_array = render_string_array(events);

    format!(
        "export const tauriCommands = {commands_array} as const;\n\
export const tauriEvents = {events_array} as const;\n\
export type TauriCommand = (typeof tauriCommands)[number];\n\
export type TauriEvent = (typeof tauriEvents)[number];\n"
    )
}

fn render_string_array(values: &[String]) -> String {
    serde_json::to_string(values).unwrap()
}

fn write_if_changed(path: &PathBuf, content: &str) -> bool {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    match fs::read_to_string(path) {
        Ok(existing) if existing == content => false,
        _ => {
            fs::write(path, content).unwrap();
            true
        }
    }
}

fn is_rust_ident(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return false;
    }
    chars.all(|c| c == '_' || c.is_ascii_alphanumeric())
}
