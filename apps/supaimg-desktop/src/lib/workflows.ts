import {
  workflowsData,
  type OutputBehavior,
  type Workflow,
  type WorkflowTask,
} from "./workflows.generated";
import {
  workflowSettingsDefaults,
  workflowSettingsSchema,
} from "@/lib/generated/workflow-settings";
import type { ConvertOutputFormat, WorkflowSettingField } from "@/lib/generated/workflow-settings";

export type { OutputBehavior, Workflow, WorkflowTask } from "./workflows.generated";
export type {
  BlurMode,
  ConvertOutputFormat,
  RemoveBgOutputFormat,
  WorkflowSettingField,
  WorkflowSettingType,
  WorkflowSettingsMap,
} from "@/lib/generated/workflow-settings";

type WorkflowConfigBase = {
  id: Workflow;
  title: string;
  actionLabel: string;
  processingLabel: string;
  inputExtensions: readonly string[];
  outputSuffix: string;
  outputExtension: string | null;
  outputBehavior: OutputBehavior;
  task: WorkflowTask;
  route: string;
};

type WorkflowConfig = Omit<WorkflowConfigBase, "outputExtension"> & {
  outputExtension?: string;
  settingsSchema: readonly WorkflowSettingField[];
};

const settingsSchemaMap = workflowSettingsSchema as Record<
  Workflow,
  readonly WorkflowSettingField[]
>;

const baseWorkflows = workflowsData.workflows as readonly WorkflowConfigBase[];

export const workflows = baseWorkflows.reduce<Record<Workflow, WorkflowConfig>>(
  (acc, workflow) => {
    acc[workflow.id] = {
      ...workflow,
      outputExtension: workflow.outputExtension ?? undefined,
      settingsSchema: settingsSchemaMap[workflow.id],
    };
    return acc;
  },
  {} as Record<Workflow, WorkflowConfig>,
);

export const defaultWorkflowSettings = workflowSettingsDefaults;

export const getWorkflow = (workflow: Workflow) => workflows[workflow];

export const convertFormatExtension = (format: ConvertOutputFormat) =>
  format === "jpeg" ? "jpg" : format;
