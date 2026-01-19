import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const jsonPath = resolve(root, "apps/supaimg-desktop/workflows.json");
const tsOut = resolve(root, "apps/supaimg-desktop/src/lib/workflows.generated.ts");
const rsOut = resolve(root, "apps/supaimg-desktop/src-tauri/src/workflow_generated.rs");

const raw = readFileSync(jsonPath, "utf8");
const data = JSON.parse(raw) as { workflows: Array<Record<string, unknown>> };
if (!Array.isArray(data.workflows)) {
  throw new Error("workflows.json missing workflows array");
}
const workflows = data.workflows;

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
};

const expectString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const workflowIds = workflows.map((workflow, index) =>
  expectString(workflow.id, `workflows[${index}].id`),
);
const workflowTasks = unique(
  workflows.map((workflow, index) => expectString(workflow.task, `workflows[${index}].task`)),
);
const outputBehaviors = unique(
  workflows.map((workflow, index) =>
    expectString(workflow.outputBehavior, `workflows[${index}].outputBehavior`),
  ),
);

const toPascalCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const workflowVariants = workflowIds.map(toPascalCase);
const taskVariants = workflowTasks.map(toPascalCase);

const tsContent =
  `export const workflowsData = ${JSON.stringify(data, null, 2)} as const;\n` +
  `\n` +
  `export const workflowIds = ${JSON.stringify(workflowIds, null, 2)} as const;\n` +
  `export const workflowTaskIds = ${JSON.stringify(workflowTasks, null, 2)} as const;\n` +
  `export const outputBehaviors = ${JSON.stringify(outputBehaviors, null, 2)} as const;\n` +
  `\n` +
  `export type Workflow = (typeof workflowIds)[number];\n` +
  `export type WorkflowTask = (typeof workflowTaskIds)[number];\n` +
  `export type OutputBehavior = (typeof outputBehaviors)[number];\n`;

const rustEnum = (name: string, variants: string[]) => {
  const body = variants.map((variant) => `    ${variant},`).join("\n");
  return (
    `#[derive(Debug, Copy, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]\n` +
    `#[serde(rename_all = "snake_case")]\n` +
    `pub enum ${name} {\n${body}\n}\n`
  );
};

const rustEnumTask = (name: string, variants: string[]) => {
  const body = variants.map((variant) => `    ${variant},`).join("\n");
  return (
    `#[derive(Debug, Copy, Clone, PartialEq, Eq, Deserialize)]\n` +
    `#[serde(rename_all = "snake_case")]\n` +
    `pub enum ${name} {\n${body}\n}\n`
  );
};

const rustMatch = (fnName: string, enumName: string, values: string[], variants: string[]) => {
  const arms = values
    .map((value, index) => `        "${value}" => Some(${enumName}::${variants[index]}),`)
    .join("\n");
  return (
    `pub fn ${fnName}(value: &str) -> Option<${enumName}> {\n` +
    `    match value {\n${arms}\n        _ => None,\n    }\n}\n`
  );
};

const rustLabel = (fnName: string, enumName: string, values: string[], variants: string[]) => {
  const arms = values
    .map((value, index) => `        ${enumName}::${variants[index]} => "${value}",`)
    .join("\n");
  return (
    `pub fn ${fnName}(value: ${enumName}) -> &'static str {\n` +
    `    match value {\n${arms}\n    }\n}\n`
  );
};

const rustContent =
  `use serde::{Deserialize, Serialize};\n\n` +
  rustEnum("Workflow", workflowVariants) +
  `\n` +
  rustEnumTask("WorkflowTask", taskVariants) +
  `\n` +
  rustMatch("workflow_from_str", "Workflow", workflowIds, workflowVariants) +
  `\n` +
  rustLabel("workflow_label", "Workflow", workflowIds, workflowVariants);

const normalize = (value: string) => value.replace(/\r\n/g, "\n");
const args = new Set(process.argv.slice(2));
const check = args.has("--check");

const writeFile = (path: string, content: string) => {
  if (check) {
    const existing = readFileSync(path, "utf8");
    if (normalize(existing) !== normalize(content)) {
      throw new Error(`${path} is out of date`);
    }
    return;
  }
  writeFileSync(path, content);
};

try {
  writeFile(tsOut, tsContent);
  writeFile(rsOut, rustContent);
} catch (error) {
  if (check) {
    console.error(String(error));
    process.exit(1);
  }
  throw error;
}
