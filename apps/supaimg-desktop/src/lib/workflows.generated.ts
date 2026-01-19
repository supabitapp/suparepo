export type Workflow = "compress" | "convert" | "remove_bg" | "blur_text";
export type WorkflowTask = "compress" | "convert" | "remove_bg" | "blur_text";
export type OutputBehavior = "allow_override" | "always_copy";

export const workflowIds = ["compress", "convert", "remove_bg", "blur_text"] as const;
export const workflowTasks = ["compress", "convert", "remove_bg", "blur_text"] as const;
export const outputBehaviors = ["allow_override", "always_copy"] as const;
