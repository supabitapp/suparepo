import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Slider } from "@repo/ui/components/ui/slider";
import { cn } from "@repo/ui/lib/utils";
import { ArrowDown01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { getWorkflow, type Workflow, type WorkflowSettingField } from "@/lib/workflows";
import { useStore } from "@/store";

type WorkflowSettingsPanelProps = {
  workflow: Workflow;
};

type GroupedFields = {
  name: string | null;
  fields: WorkflowSettingField[];
};

const groupFields = (fields: readonly WorkflowSettingField[]) => {
  const groups: GroupedFields[] = [];
  const groupMap = new Map<string, GroupedFields>();
  fields.forEach((field) => {
    const key = field.group ?? "";
    let group = groupMap.get(key);
    if (!group) {
      group = { name: field.group ?? null, fields: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.fields.push(field);
  });
  return groups;
};

export function WorkflowSettingsPanel({ workflow }: WorkflowSettingsPanelProps) {
  const [open, setOpen] = useState(true);
  const config = getWorkflow(workflow);
  const settings = useStore((s) => s.settings.workflowSettings[workflow]);
  const setWorkflowSetting = useStore((s) => s.setWorkflowSetting);
  const groups = useMemo(() => {
    if (workflow !== "convert") {
      return groupFields(config.settingsSchema);
    }
    const outputFormat = (settings as { outputFormat?: string }).outputFormat;
    const targetGroup =
      outputFormat === "jpeg"
        ? "JPEG"
        : outputFormat === "png"
          ? "PNG"
          : outputFormat === "webp"
            ? "WebP"
            : "GIF";
    const filtered = config.settingsSchema.filter(
      (field) => field.key === "outputFormat" || field.group === targetGroup,
    );
    return groupFields(filtered);
  }, [config.settingsSchema, settings, workflow]);

  return (
    <div className={cn("bg-background shrink-0 border-l border-border", open ? "w-72" : "w-12")}>
      <div className="flex h-full flex-col">
        {open ? (
          <div className="flex-1 overflow-auto">
            <div className="space-y-4 px-4 py-4">
              {groups.map((group) => (
                <div
                  key={group.name ?? "default"}
                  className="divide-y divide-border rounded border border-border"
                >
                  {group.name ? (
                    <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                      {group.name}
                    </div>
                  ) : null}
                  {group.fields.map((field) => {
                    const fieldId = `${workflow}-${field.key}`;
                    const value = settings[field.key as keyof typeof settings];
                    if (field.type === "boolean") {
                      return (
                        <div
                          key={field.key}
                          className="flex items-center justify-between gap-6 px-4 py-3"
                        >
                          <div>
                            <label className="block text-sm text-foreground" htmlFor={fieldId}>
                              {field.label}
                            </label>
                            {field.description ? (
                              <div className="text-xs text-muted-foreground">
                                {field.description}
                              </div>
                            ) : null}
                          </div>
                          <Checkbox
                            id={fieldId}
                            checked={Boolean(value)}
                            onCheckedChange={(checked) => {
                              setWorkflowSetting(
                                workflow,
                                field.key as never,
                                Boolean(checked) as never,
                              );
                            }}
                          />
                        </div>
                      );
                    }
                    if (field.type === "number") {
                      const numericValue =
                        typeof value === "number" ? value : Number(field.default);
                      return (
                        <div
                          key={field.key}
                          className="flex items-start justify-between gap-6 px-4 py-3"
                        >
                          <div>
                            <label className="block text-sm text-foreground" htmlFor={fieldId}>
                              {field.label}
                            </label>
                            {field.description ? (
                              <div className="text-xs text-muted-foreground">
                                {field.description}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex w-36 flex-col items-end gap-2">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {numericValue}
                            </span>
                            <Slider
                              id={fieldId}
                              min={field.min ?? 0}
                              max={field.max ?? 100}
                              step={field.step ?? 1}
                              value={[numericValue]}
                              onValueChange={(next) => {
                                const nextValue = Array.isArray(next)
                                  ? (next[0] ?? numericValue)
                                  : next;
                                setWorkflowSetting(
                                  workflow,
                                  field.key as never,
                                  nextValue as never,
                                );
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                    if (field.type === "enum") {
                      const options = field.options ?? [];
                      return (
                        <div
                          key={field.key}
                          className="flex items-center justify-between gap-6 px-4 py-3"
                        >
                          <div>
                            <label className="block text-sm text-foreground" htmlFor={fieldId}>
                              {field.label}
                            </label>
                            {field.description ? (
                              <div className="text-xs text-muted-foreground">
                                {field.description}
                              </div>
                            ) : null}
                          </div>
                          <Select
                            value={String(value ?? field.default)}
                            onValueChange={(nextValue) => {
                              const resolved = nextValue ?? field.default;
                              setWorkflowSetting(workflow, field.key as never, resolved as never);
                            }}
                          >
                            <SelectTrigger id={fieldId} className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex min-h-12 items-center justify-start border-t border-border px-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex size-8 items-center justify-center text-muted-foreground hover:bg-muted/40"
            aria-label={open ? "Collapse settings" : "Open settings"}
          >
            {open ? (
              <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-4 -rotate-90" />
            ) : (
              <HugeiconsIcon icon={Settings01Icon} className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
