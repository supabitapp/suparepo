import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type WorkflowJson = {
  id: string;
  task: string;
  outputBehavior: string;
};

type WorkflowsJson = {
  workflows: WorkflowJson[];
};

const root = process.cwd();
const sourcePath = resolve(root, "apps/supaimg-desktop/workflows.json");
const tsOut = resolve(root, "apps/supaimg-desktop/src/lib/workflows.generated.ts");
const rsOut = resolve(root, "apps/supaimg-desktop/src-tauri/src/workflow_generated.rs");

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const check = args.has("--check") || !write;

const raw = readFileSync(sourcePath, "utf8");
const data = JSON.parse(raw) as WorkflowsJson;

if (!data || typeof data !== "object" || !Array.isArray(data.workflows)) {
  throw new Error("workflows.json must have a workflows array");
}

const workflows = data.workflows.map((workflow, index) => {
  if (!workflow || typeof workflow !== "object") {
    throw new Error(`workflow at index ${index} must be an object`);
  }
  const { id, task, outputBehavior } = workflow;
  if (typeof id !== "string") throw new Error(`workflow ${index} id must be string`);
  if (typeof task !== "string") throw new Error(`workflow ${index} task must be string`);
  if (typeof outputBehavior !== "string") {
    throw new Error(`workflow ${index} outputBehavior must be string`);
  }
  return { id, task, outputBehavior };
});

const uniq = (values: string[]) => Array.from(new Set(values));
const workflowIds = uniq(workflows.map((workflow) => workflow.id));
const workflowTasks = uniq(workflows.map((workflow) => workflow.task));
const outputBehaviors = uniq(workflows.map((workflow) => workflow.outputBehavior));

const tsString = (value: string) => JSON.stringify(value);
const rustString = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;

const toPascalCase = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

const tsLines: string[] = [
  `export type Workflow = ${workflowIds.map(tsString).join(" | ")};`,
  `export type WorkflowTask = ${workflowTasks.map(tsString).join(" | ")};`,
  `export type OutputBehavior = ${outputBehaviors.map(tsString).join(" | ")};`,
  "",
  `export const workflowIds = [${workflowIds.map(tsString).join(", ")}] as const;`,
  `export const workflowTasks = [${workflowTasks.map(tsString).join(", ")}] as const;`,
  `export const outputBehaviors = [${outputBehaviors.map(tsString).join(", ")}] as const;`,
  "",
];

const tsContent = tsLines.join("\n");

const workflowVariants = workflowIds.map((id) => ({ id, variant: toPascalCase(id) }));
const taskVariants = workflowTasks.map((task) => ({ task, variant: toPascalCase(task) }));

const rsLines: string[] = [
  "use serde::{Deserialize, Serialize};",
  "",
  "#[derive(Debug, Copy, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]",
  "#[serde(rename_all = \"snake_case\")]",
  "pub enum Workflow {",
];

for (const variant of workflowVariants) {
  rsLines.push(`    ${variant.variant},`);
}

rsLines.push("}");
rsLines.push("");
rsLines.push("#[derive(Debug, Copy, Clone, PartialEq, Eq, Deserialize)]");
rsLines.push("#[serde(rename_all = \"snake_case\")]" );
rsLines.push("pub enum WorkflowTask {");

for (const variant of taskVariants) {
  rsLines.push(`    ${variant.variant},`);
}

rsLines.push("}");
rsLines.push("");
rsLines.push("pub fn workflow_from_str(value: &str) -> Option<Workflow> {");
rsLines.push("    match value {");

for (const variant of workflowVariants) {
  rsLines.push(`        ${rustString(variant.id)} => Some(Workflow::${variant.variant}),`);
}

rsLines.push("        _ => None,");
rsLines.push("    }");
rsLines.push("}");
rsLines.push("");

const rsContent = rsLines.join("\n");

const mismatches: string[] = [];

const checkFile = (path: string, content: string) => {
  try {
    const existing = readFileSync(path, "utf8");
    if (existing !== content) mismatches.push(path);
  } catch {
    mismatches.push(path);
  }
};

if (check) {
  checkFile(tsOut, tsContent);
  checkFile(rsOut, rsContent);
}

if (write) {
  writeFileSync(tsOut, tsContent);
  writeFileSync(rsOut, rsContent);
}

if (check && mismatches.length > 0) {
  const list = mismatches.map((path) => `- ${path}`).join("\n");
  throw new Error(`Generated workflows are out of date:\n${list}`);
}
