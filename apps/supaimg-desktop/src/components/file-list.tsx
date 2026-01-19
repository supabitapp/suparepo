import { ContextMenuItem } from "@repo/ui/components/ui/context-menu";
import { error as logError } from "@tauri-apps/plugin-log";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { columnsForWorkflow } from "@/components/file-columns";
import { COMMANDS, invokeCommand } from "@/lib/tauri";
import type { Workflow } from "@/lib/workflows";
import { type FileItem, selectWorkflowFiles, useStore } from "@/store";

type FileListProps = {
  workflow: Workflow;
};

const ImageCompareModal = lazy(() =>
  import("./image-compare-modal").then((mod) => ({
    default: mod.ImageCompareModal,
  })),
);
const prefetchImageCompareModal = () => void import("./image-compare-modal");
const canCompare = (file: FileItem) => file.status === "done" && file.hasOutputCopy === true;

export function FileList({ workflow }: FileListProps) {
  const fileOrder = useStore((s) => s.fileOrder);
  const filesById = useStore((s) => s.filesById);
  const files = useMemo(
    () => selectWorkflowFiles(fileOrder, filesById, workflow),
    [fileOrder, filesById, workflow],
  );
  const columns = useMemo(() => columnsForWorkflow(workflow), [workflow]);
  const platform = useStore((s) => s.platform);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeFile = useMemo(() => {
    if (!activeFileId) return null;
    return files.find((file) => file.id === activeFileId) ?? null;
  }, [activeFileId, files]);

  const handleRevealInFinder = useCallback(async (file: FileItem) => {
    try {
      await invokeCommand(COMMANDS.revealInFinder, { path: file.path });
    } catch (err) {
      void logError(`[reveal] failed path="${file.path}" err=${String(err)}`);
    }
  }, []);

  const revealLabel =
    platform === "windows"
      ? "Show in Explorer"
      : platform === "linux"
        ? "Show in File Manager"
        : "Reveal in Finder";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* File list */}
      <div className="scrollbar-none flex-1 overflow-auto">
        <DataTable
          columns={columns}
          data={files}
          onRowHover={(file) => {
            if (canCompare(file)) {
              prefetchImageCompareModal();
            }
          }}
          onRowClick={(file) => {
            if (canCompare(file)) {
              prefetchImageCompareModal();
              setActiveFileId(file.id);
            }
          }}
          getRowClassName={(file) =>
            canCompare(file) ? "cursor-pointer hover:bg-muted/30" : "cursor-default"
          }
          renderRowContextMenu={(file) => (
            <ContextMenuItem onClick={() => void handleRevealInFinder(file)}>
              {revealLabel}
            </ContextMenuItem>
          )}
        />
      </div>
      {activeFile ? (
        <Suspense fallback={null}>
          <ImageCompareModal file={activeFile} onClose={() => setActiveFileId(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}
