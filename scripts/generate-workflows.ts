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
const expectString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const expectStringArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((item, index) => expectString(item, `${label}[${index}]`));
};

const workflows = data.workflows.map((workflow, index) => ({
  id: expectString(workflow.id, `workflows[${index}].id`),
  title: expectString(workflow.title, `workflows[${index}].title`),
  actionLabel: expectString(workflow.actionLabel, `workflows[${index}].actionLabel`),
  processingLabel: expectString(workflow.processingLabel, `workflows[${index}].processingLabel`),
  inputExtensions: expectStringArray(
    workflow.inputExtensions,
    `workflows[${index}].inputExtensions`,
  ),
  outputSuffix: expectString(workflow.outputSuffix, `workflows[${index}].outputSuffix`),
  outputExtension:
    workflow.outputExtension === null
      ? null
      : expectString(workflow.outputExtension, `workflows[${index}].outputExtension`),
  outputBehavior: expectString(workflow.outputBehavior, `workflows[${index}].outputBehavior`),
  task: expectString(workflow.task, `workflows[${index}].task`),
  route: expectString(workflow.route, `workflows[${index}].route`),
}));

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

const workflowIds = workflows.map((workflow) => workflow.id);
const workflowTasks = unique(workflows.map((workflow) => workflow.task));
const outputBehaviors = unique(workflows.map((workflow) => workflow.outputBehavior));

const toPascalCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const workflowVariants = workflowIds.map(toPascalCase);
const taskVariants = workflowTasks.map(toPascalCase);

const formatString = (value: string) => JSON.stringify(value);

const formatInlineArray = (values: string[]) =>
  `[${values.map((value) => formatString(value)).join(", ")}]`;

const formatWorkflowsData = () => {
  const lines = ["export const workflowsData = {", "  workflows: ["];
  for (const workflow of workflows) {
    lines.push(
      "    {",
      `      id: ${formatString(workflow.id)},`,
      `      title: ${formatString(workflow.title)},`,
      `      actionLabel: ${formatString(workflow.actionLabel)},`,
      `      processingLabel: ${formatString(workflow.processingLabel)},`,
      `      inputExtensions: ${formatInlineArray(workflow.inputExtensions)},`,
      `      outputSuffix: ${formatString(workflow.outputSuffix)},`,
      `      outputExtension: ${
        workflow.outputExtension === null ? "null" : formatString(workflow.outputExtension)
      },`,
      `      outputBehavior: ${formatString(workflow.outputBehavior)},`,
      `      task: ${formatString(workflow.task)},`,
      `      route: ${formatString(workflow.route)},`,
      "    },",
    );
  }
  lines.push("  ],", "} as const;");
  return `${lines.join("\n")}\n`;
};

const tsContent =
  formatWorkflowsData() +
  `\n` +
  `export const workflowIds = ${formatInlineArray(workflowIds)} as const;\n` +
  `export const workflowTaskIds = ${formatInlineArray(workflowTasks)} as const;\n` +
  `export const outputBehaviors = ${formatInlineArray(outputBehaviors)} as const;\n` +
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
