use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let manifest_path = manifest_dir.join("../src/lib/tauri.manifest.ts");
    let lib_rs_path = manifest_dir.join("src/lib.rs");

    println!("cargo:rerun-if-changed={}", manifest_path.display());
    println!("cargo:rerun-if-changed={}", lib_rs_path.display());

    if let Err(err) = validate_manifest(&manifest_path, &lib_rs_path) {
        panic!("{err}");
    }

    tauri_build::build()
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
