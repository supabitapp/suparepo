import { Button } from "@repo/ui/components/ui/button";
import { useMemo } from "react";
import { formatBytes } from "@/lib/format";
import type { Workflow } from "@/lib/workflows";
import { selectWorkflowFiles, useStore } from "@/store";

type ToolbarProps = {
  workflow: Workflow;
};

export function Toolbar({ workflow }: ToolbarProps) {
  const clearAll = useStore((s) => s.clearAll);
  const fileOrder = useStore((s) => s.fileOrder);
  const filesById = useStore((s) => s.filesById);
  const files = useMemo(
    () => selectWorkflowFiles(fileOrder, filesById, workflow),
    [fileOrder, filesById, workflow],
  );

  const stats = useMemo(() => {
    const doneFiles = files.filter((f) => f.status === "done");
    const original = doneFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const output = doneFiles.reduce((acc, f) => acc + (f.outputSize ?? f.originalSize), 0);
    const savings = original > 0 ? ((original - output) / original) * 100 : 0;
    return { count: files.length, original, output, savings };
  }, [files]);

  const hasCompleted = files.some((f) => f.status === "done");
  const hasClearable = files.some((f) => f.status !== "processing");
  const isRemoveBg = workflow === "remove_bg";
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-border pl-4 pr-3 py-3">
      <div className="flex-1 text-center text-xs tabular-nums">
        {hasCompleted && (
          <>
            {stats.count} {stats.count === 1 ? "file" : "files"}
            {isRemoveBg ? null : (
              <>
                {" "}
                • {formatBytes(stats.original)} → {formatBytes(stats.output)}{" "}
                {stats.savings > 0 && (
                  <span className="text-green-500">(-{stats.savings.toFixed(0)}%)</span>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {files.length > 0 && (
          <Button variant="outline" onClick={() => clearAll(workflow)} disabled={!hasClearable}>
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
