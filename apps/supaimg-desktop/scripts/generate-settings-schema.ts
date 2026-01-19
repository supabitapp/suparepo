import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const schemaPath = path.join(appRoot, "settings-schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
  general: Record<string, { type: "boolean" | "number" | "enum"; default: unknown }>;
  workflows: Record<
    string,
    {
      settings: Array<{
        key: string;
        label: string;
        description?: string;
        type: "boolean" | "number" | "enum";
        group?: string;
        min?: number;
        max?: number;
        step?: number;
        options?: Array<{ label: string; value: string }>;
        default: unknown;
      }>;
    }
  >;
};

const enumTypeNames: Record<string, string> = {
  "convert.outputFormat": "ConvertOutputFormat",
  "remove_bg.outputFormat": "RemoveBgOutputFormat",
  "blur_text.blurMode": "BlurMode",
};

const rustNumericTypes: Record<string, "u8" | "u16" | "f32"> = {
  "convert.jpegQuality": "u8",
  "convert.pngCompressionLevel": "u8",
  "convert.webpQuality": "u8",
  "convert.gifColors": "u16",
  "blur_text.blurStrength": "u8",
  "blur_text.padding": "u8",
  "blur_text.confidenceThreshold": "f32",
  "blur_text.minBoxSize": "u16",
};

const workflowKeys = Object.keys(schema.workflows);

const toPascalCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+(.)/g, (_, group) => group.toUpperCase())
    .replace(/^(.)/, (match) => match.toUpperCase());

const toUpperSnake = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .replace(/__+/g, "_")
    .toUpperCase();

const workflowSchema = Object.fromEntries(
  workflowKeys.map((key) => [key, schema.workflows[key]?.settings ?? []]),
);

const workflowDefaults = Object.fromEntries(
  workflowKeys.map((workflow) => {
    const fields = schema.workflows[workflow]?.settings ?? [];
    const defaults = Object.fromEntries(fields.map((field) => [field.key, field.default]));
    return [workflow, defaults];
  }),
);

const generalDefaults = Object.fromEntries(
  Object.entries(schema.general).map(([key, value]) => [key, value.default]),
);

const tsEnumTypes = Object.entries(enumTypeNames)
  .map(([pathKey, typeName]) => {
    const [workflow, fieldKey] = pathKey.split(".");
    const field = schema.workflows[workflow]?.settings.find((item) => item.key === fieldKey);
    const values = field?.options?.map((option) => option.value) ?? [];
    const union = values.map((value) => `"${value}"`).join(" | ");
    return `export type ${typeName} = ${union};`;
  })
  .join("\n\n");

const workflowTypeDefs = workflowKeys
  .map((workflow) => {
    const fields = schema.workflows[workflow]?.settings ?? [];
    const typeName = `${toPascalCase(workflow)}Settings`;
    const lines = fields.map((field) => {
      const pathKey = `${workflow}.${field.key}`;
      if (field.type === "boolean") return `  ${field.key}: boolean;`;
      if (field.type === "number") return `  ${field.key}: number;`;
      if (field.type === "enum") {
        const enumName = enumTypeNames[pathKey];
        if (enumName) return `  ${field.key}: ${enumName};`;
        const values = field.options?.map((option) => option.value) ?? [];
        const union = values.map((value) => `"${value}"`).join(" | ");
        return `  ${field.key}: ${union};`;
      }
      return `  ${field.key}: unknown;`;
    });
    return `export type ${typeName} = {\n${lines.join("\n")}\n};`;
  })
  .join("\n\n");

const workflowMapLines = workflowKeys.map(
  (workflow) => `  ${workflow}: ${toPascalCase(workflow)}Settings;`,
);

const generalTypeLines = Object.entries(schema.general).map(([key, value]) => {
  if (value.type === "boolean") return `  ${key}: boolean;`;
  if (value.type === "number") return `  ${key}: number;`;
  if (value.type === "enum") return `  ${key}: string;`;
  return `  ${key}: unknown;`;
});

const tsLines = [
  `export type Workflow = ${workflowKeys.map((key) => `"${key}"`).join(" | ")};`,
  `export type WorkflowSettingType = "boolean" | "number" | "enum";`,
  `export type WorkflowSettingOption = { label: string; value: string };`,
  `export type WorkflowSettingValue = boolean | number | string;`,
  `export type WorkflowSettingField = {\n  key: string;\n  label: string;\n  description?: string;\n  type: WorkflowSettingType;\n  group?: string;\n  min?: number;\n  max?: number;\n  step?: number;\n  options?: readonly WorkflowSettingOption[];\n  default: WorkflowSettingValue;\n};`,
  tsEnumTypes,
  workflowTypeDefs,
  `export type WorkflowSettingsMap = {\n${workflowMapLines.join("\n")}\n};`,
  `export type GeneralSettings = {\n${generalTypeLines.join("\n")}\n};`,
  `export type WorkflowSettingsSchema = Record<Workflow, readonly WorkflowSettingField[]>;`,
  `export const workflowSettingsSchema = ${JSON.stringify(
    workflowSchema,
    null,
    2,
  )} as const satisfies WorkflowSettingsSchema;`,
  `export const workflowSettingsDefaults = ${JSON.stringify(
    workflowDefaults,
    null,
    2,
  )} as const satisfies WorkflowSettingsMap;`,
  `export const generalSettingsDefaults = ${JSON.stringify(
    generalDefaults,
    null,
    2,
  )} as const satisfies GeneralSettings;`,
].filter(Boolean);

const tsOutput = tsLines.join("\n\n") + "\n";

const tsOutDir = path.join(appRoot, "src", "lib", "generated");
mkdirSync(tsOutDir, { recursive: true });
writeFileSync(path.join(tsOutDir, "workflow-settings.ts"), tsOutput);

const rustEnumDefs = Object.entries(enumTypeNames)
  .map(([pathKey, typeName]) => {
    const [workflow, fieldKey] = pathKey.split(".");
    const field = schema.workflows[workflow]?.settings.find((item) => item.key === fieldKey);
    const values = field?.options?.map((option) => option.value) ?? [];
    const variants = values.map((value) => `    ${toPascalCase(value)},`).join("\n");
    return `#[derive(Debug, Clone, Copy, Deserialize)]\n#[serde(rename_all = "lowercase")]\npub enum ${typeName} {\n${variants}\n}`;
  })
  .join("\n\n");

const rustConstants: string[] = [];

const pushConst = (name: string, type: string, value: string) => {
  rustConstants.push(`pub const ${name}: ${type} = ${value};`);
};

for (const workflow of workflowKeys) {
  const fields = schema.workflows[workflow]?.settings ?? [];
  for (const field of fields) {
    const baseName = `${toUpperSnake(workflow)}_${toUpperSnake(field.key)}`;
    const pathKey = `${workflow}.${field.key}`;
    if (field.type === "boolean") {
      pushConst(`${baseName}_DEFAULT`, "bool", String(field.default));
    }
    if (field.type === "enum") {
      const enumName = enumTypeNames[pathKey];
      if (enumName) {
        const variant = toPascalCase(String(field.default));
        pushConst(`${baseName}_DEFAULT`, enumName, `${enumName}::${variant}`);
      }
    }
    if (field.type === "number") {
      const rustType = rustNumericTypes[pathKey];
      if (!rustType) continue;
      if (typeof field.min === "number") {
        pushConst(`${baseName}_MIN`, rustType, String(field.min));
      }
      if (typeof field.max === "number") {
        pushConst(`${baseName}_MAX`, rustType, String(field.max));
      }
      pushConst(`${baseName}_DEFAULT`, rustType, String(field.default));
    }
  }
}

const rustOutDir = path.join(appRoot, "src-tauri", "src", "generated");
mkdirSync(rustOutDir, { recursive: true });

const rustOutput = [
  "use serde::Deserialize;",
  "",
  rustEnumDefs,
  "",
  rustConstants.join("\n"),
  "",
].join("\n");

writeFileSync(path.join(rustOutDir, "workflow_settings.rs"), rustOutput);

const rustModPath = path.join(rustOutDir, "mod.rs");
writeFileSync(rustModPath, "pub mod workflow_settings;\n");
