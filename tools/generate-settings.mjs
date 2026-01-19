import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "packages/settings/settings.schema.json");
const defaultsPath = resolve(root, "packages/settings/settings.defaults.json");
const tsPath = resolve(root, "packages/settings/src/index.ts");
const rustPath = resolve(root, "apps/supaimg-desktop/src-tauri/src/settings.rs");

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const defaults = buildDefaults(schema, []);
writeFileSync(defaultsPath, `${JSON.stringify(defaults, null, 2)}\n`);

const { ts, rust } = generate(schema, defaults);
writeFileSync(tsPath, ts);
writeFileSync(rustPath, rust);

function generate(rootSchema, rootDefaults) {
  const objectDefs = [];
  const enumDefs = [];
  const objectByPath = new Map();
  const enumByPath = new Map();

  const rootName = rootSchema.title || "Settings";
  collect(rootSchema, rootName, []);

  const ts = renderTs(rootSchema, rootDefaults, rootName, objectDefs, enumDefs, objectByPath, enumByPath);
  const rust = renderRust(rootSchema, rootDefaults, rootName, objectDefs, enumDefs, objectByPath, enumByPath);

  return { ts, rust };

  function collect(node, name, path) {
    if (node.type !== "object") return;
    objectDefs.push({ name, node, path });
    objectByPath.set(pathKey(path), name);

    const properties = node.properties || {};
    for (const [prop, child] of Object.entries(properties)) {
      const childPath = [...path, prop];
      if (child.type === "object") {
        const childName = child.title || `${toPascalCase(prop)}Settings`;
        collect(child, childName, childPath);
        continue;
      }
      if (Array.isArray(child.enum)) {
        const enumName = child.title || toPascalCase(childPath.join("_"));
        enumDefs.push({ name: enumName, node: child, path: childPath });
        enumByPath.set(pathKey(childPath), enumName);
      }
    }
  }
}

function renderTs(rootSchema, rootDefaults, rootName, objectDefs, enumDefs, objectByPath, enumByPath) {
  const enumBlocks = enumDefs.map((def) => {
    const values = def.node.enum.map((value) => JSON.stringify(value)).join(" | ");
    return `export type ${def.name} = ${values};`;
  });

  const enumValueBlocks = enumDefs.map((def) => {
    const values = def.node.enum.map((value) => JSON.stringify(value)).join(", ");
    return `const ${def.name}Values = [${values}] as const;`;
  });

  const objectBlocks = objectDefs.map((def) => {
    const properties = def.node.properties || {};
    const lines = Object.entries(properties).map(([prop, child]) => {
      const type = tsType(child, [...def.path, prop], objectByPath, enumByPath);
      return `  ${prop}: ${type};`;
    });
    return `export type ${def.name} = {\n${lines.join("\n")}\n};`;
  });

  const defaultsLiteral = JSON.stringify(rootDefaults, null, 2);
  const normalizeBlocks = objectDefs.map((def) => {
    const inputType = def.name === rootName ? "SettingsInput" : "unknown";
    return renderTsNormalizer(def, objectByPath, enumByPath, inputType);
  });

  return [
    ...enumBlocks,
    ...objectBlocks,
    "export type DeepPartial<T> = {",
    "  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];",
    "};",
    `export type SettingsInput = DeepPartial<${rootName}>;`,
    `export const settingsDefaults: ${rootName} = ${defaultsLiteral};`,
    "const isRecord = (value: unknown): value is Record<string, unknown> =>",
    "  typeof value === \"object\" && value !== null && !Array.isArray(value);",
    "const coerceBoolean = (value: unknown, fallback: boolean) =>",
    "  typeof value === \"boolean\" ? value : fallback;",
    "const coerceNumber = (value: unknown, fallback: number, min?: number, max?: number) => {",
    "  if (typeof value !== \"number\" || Number.isNaN(value)) return fallback;",
    "  let next = value;",
    "  if (typeof min === \"number\") next = Math.max(min, next);",
    "  if (typeof max === \"number\") next = Math.min(max, next);",
    "  return next;",
    "};",
    "const coerceEnum = <T extends string>(value: unknown, options: readonly T[], fallback: T) => {",
    "  if (typeof value !== \"string\") return fallback;",
    "  return options.includes(value as T) ? (value as T) : fallback;",
    "};",
    ...enumValueBlocks,
    ...normalizeBlocks,
    "",
  ].join("\n");
}

function renderTsNormalizer(def, objectByPath, enumByPath, inputType) {
  const properties = def.node.properties || {};
  const defaultBase = ["settingsDefaults", ...def.path].join(".");
  const lines = Object.entries(properties).map(([prop, child]) => {
    if (child.type === "object") {
      const childType = objectByPath.get(pathKey([...def.path, prop])) || "unknown";
      return `    ${prop}: normalize${childType}(value.${prop}),`;
    }
    const defaultRef = `${defaultBase}.${prop}`;
    if (Array.isArray(child.enum)) {
      const enumName = enumByPath.get(pathKey([...def.path, prop])) || "string";
      return `    ${prop}: coerceEnum(value.${prop}, ${enumName}Values, ${defaultRef}),`;
    }
    if (child.type === "boolean") {
      return `    ${prop}: coerceBoolean(value.${prop}, ${defaultRef}),`;
    }
    if (child.type === "integer" || child.type === "number") {
      const min = child.minimum ?? undefined;
      const max = child.maximum ?? undefined;
      const minArg = min === undefined ? "undefined" : String(min);
      const maxArg = max === undefined ? "undefined" : String(max);
      return `    ${prop}: coerceNumber(value.${prop}, ${defaultRef}, ${minArg}, ${maxArg}),`;
    }
    return `    ${prop}: typeof value.${prop} === \"string\" ? value.${prop} : ${defaultRef},`;
  });

  return [
    `export const normalize${def.name} = (input?: ${inputType}): ${def.name} => {`,
    "  const value = isRecord(input) ? input : {};",
    "  return {",
    ...lines,
    "  };",
    "};",
  ].join("\n");
}

function renderRust(rootSchema, rootDefaults, rootName, objectDefs, enumDefs, objectByPath, enumByPath) {
  const enumBlocks = enumDefs.map((def) => renderRustEnum(def.name, def.node));
  const structBlocks = objectDefs.map((def) => renderRustStruct(def, objectByPath, enumByPath));
  const defaultBlocks = objectDefs.map((def) => renderRustDefaultImpl(def, objectByPath, enumByPath));
  const normalizeBlocks = objectDefs.map((def) => renderRustNormalizeImpl(def, objectByPath, enumByPath));
  const defaultFns = collectRustDefaultFunctions(rootSchema, enumByPath, objectByPath);
  const settingsImpl = renderRustSettingsImpl(rootSchema, rootName);

  const parts = [
    "use serde::{Deserialize, Serialize};",
    "",
    ...enumBlocks,
    ...structBlocks,
    ...defaultBlocks,
    ...normalizeBlocks,
    settingsImpl,
    ...defaultFns,
    renderRustTests(),
    "",
  ];

  return parts.filter((part) => part.length > 0).join("\n");
}

function renderRustEnum(name, node) {
  const variants = node.enum.map((value) => {
    const variant = toPascalCase(String(value));
    const rename = value === variant ? "" : `#[serde(rename = \"${value}\")]\n  `;
    return `${rename}${variant}`;
  });
  return `#[derive(Clone, PartialEq, Serialize, Deserialize)]\npub enum ${name} {\n  ${variants.join(",\n  ")}\n}\n`;
}

function renderRustStruct(def, objectByPath, enumByPath) {
  const properties = def.node.properties || {};
  const fields = Object.entries(properties).map(([prop, child]) => {
    const fieldName = toSnakeCase(prop);
    const rustType = rustTypeFor(child, [...def.path, prop], objectByPath, enumByPath);
    const rename = fieldName === prop ? "" : `  #[serde(rename = \"${prop}\")]\n`;
    const defaultAttr = child.type === "object"
      ? "  #[serde(default)]\n"
      : `  #[serde(default = \"${defaultFnName([...def.path, prop])}\")]\n`;
    return `${rename}${defaultAttr}  pub ${fieldName}: ${rustType},`;
  });

  return `#[derive(Clone, PartialEq, Serialize, Deserialize)]\npub struct ${def.name} {\n${fields.join("\n")}\n}\n`;
}

function renderRustDefaultImpl(def, objectByPath, enumByPath) {
  const properties = def.node.properties || {};
  const fields = Object.entries(properties).map(([prop, child]) => {
    const fieldName = toSnakeCase(prop);
    if (child.type === "object") {
      return `      ${fieldName}: ${rustTypeFor(child, [...def.path, prop], objectByPath, enumByPath)}::default(),`;
    }
    return `      ${fieldName}: ${defaultFnName([...def.path, prop])}(),`;
  });

  return `impl Default for ${def.name} {\n  fn default() -> Self {\n    Self {\n${fields.join("\n")}\n    }\n  }\n}\n`;
}

function renderRustNormalizeImpl(def, objectByPath, enumByPath) {
  const properties = def.node.properties || {};
  const lines = [];
  for (const [prop, child] of Object.entries(properties)) {
    const fieldName = toSnakeCase(prop);
    if (child.type === "object") {
      lines.push(`value.${fieldName} = value.${fieldName}.normalize();`);
      continue;
    }
    if (child.type === "integer" || child.type === "number") {
      const min = child.minimum ?? null;
      const max = child.maximum ?? null;
      if (min !== null && max !== null) {
        lines.push(`value.${fieldName} = value.${fieldName}.clamp(${rustNumber(min, child.type)}, ${rustNumber(max, child.type)});`);
      } else if (min !== null) {
        lines.push(`if value.${fieldName} < ${rustNumber(min, child.type)} { value.${fieldName} = ${rustNumber(min, child.type)}; }`);
      } else if (max !== null) {
        lines.push(`if value.${fieldName} > ${rustNumber(max, child.type)} { value.${fieldName} = ${rustNumber(max, child.type)}; }`);
      }
    }
  }

  if (lines.length === 0) {
    return `impl ${def.name} {\n  pub fn normalize(self) -> Self {\n    self\n  }\n}\n`;
  }

  const bodyLines = ["let mut value = self;", ...lines, "value"].map(
    (line) => `    ${line}`,
  );
  const body = bodyLines.join("\n");

  return `impl ${def.name} {\n  pub fn normalize(self) -> Self {\n${body}\n  }\n}\n`;
}

function renderRustSettingsImpl(rootSchema, rootName) {
  return `impl ${rootName} {\n  pub fn defaults() -> Self {\n    Self::default()\n  }\n\n  pub fn from_json(value: &str) -> Result<Self, serde_json::Error> {\n    serde_json::from_str(value).map(Self::normalize)\n  }\n}\n`;
}

function collectRustDefaultFunctions(rootSchema, enumByPath, objectByPath) {
  const functions = [];

  walk(rootSchema, [], (node, path) => {
    if (node.type === "object") return;
    if (node.default === undefined) {
      throw new Error(`Missing default for ${path.join(".")}`);
    }
    const fnName = defaultFnName(path);
    const type = rustTypeFor(node, path, objectByPath, enumByPath);
    const value = rustLiteral(node, node.default, enumByPath, path);
    functions.push(`fn ${fnName}() -> ${type} {\n  ${value}\n}\n`);
  });

  return functions;
}

function renderRustTests() {
  return `#[cfg(test)]\nmod tests {\n  use super::Settings;\n\n  #[test]\n  fn defaults_match_schema() {\n    let json = include_str!(\"../../../../packages/settings/settings.defaults.json\");\n    let defaults: Settings = serde_json::from_str(json).unwrap();\n    assert!(defaults == Settings::defaults());\n  }\n}\n`;
}

function tsType(node, path, objectByPath, enumByPath) {
  if (node.type === "object") {
    return objectByPath.get(pathKey(path)) || "unknown";
  }
  if (Array.isArray(node.enum)) {
    return enumByPath.get(pathKey(path)) || "string";
  }
  if (node.type === "string") return "string";
  if (node.type === "integer" || node.type === "number") return "number";
  if (node.type === "boolean") return "boolean";
  return "unknown";
}

function rustTypeFor(node, path, objectByPath, enumByPath) {
  if (node.type === "object") {
    return objectByPath.get(pathKey(path)) || "Settings";
  }
  if (Array.isArray(node.enum)) {
    return enumByPath.get(pathKey(path)) || "String";
  }
  if (node.type === "string") return "String";
  if (node.type === "integer") return "u32";
  if (node.type === "number") return "f64";
  if (node.type === "boolean") return "bool";
  return "String";
}

function rustLiteral(node, value, enumByPath, path) {
  if (Array.isArray(node.enum)) {
    const enumName = enumByPath.get(pathKey(path)) || "";
    return `${enumName}::${toPascalCase(String(value))}`;
  }
  if (node.type === "string") return `String::from(${JSON.stringify(String(value))})`;
  if (node.type === "integer") return `${Number(value)}`;
  if (node.type === "number") return `${Number(value)}`;
  if (node.type === "boolean") return value ? "true" : "false";
  return "Default::default()";
}

function rustNumber(value, type) {
  if (type === "number") return `${Number(value)}f64`;
  return `${Number(value)}`;
}

function buildDefaults(node, path) {
  if (node.type === "object") {
    const properties = node.properties || {};
    const result = {};
    for (const [prop, child] of Object.entries(properties)) {
      result[prop] = buildDefaults(child, [...path, prop]);
    }
    return result;
  }
  if (node.default !== undefined) return node.default;
  throw new Error(`Missing default for ${path.join(".")}`);
}

function walk(node, path, visitor) {
  if (node.type === "object") {
    const properties = node.properties || {};
    for (const [prop, child] of Object.entries(properties)) {
      walk(child, [...path, prop], visitor);
    }
    return;
  }
  visitor(node, path);
}

function defaultFnName(path) {
  return `default_${path.map((part) => toSnakeCase(part)).join("_")}`;
}

function pathKey(path) {
  return path.join(".");
}

function toPascalCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase();
}
