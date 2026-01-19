import { error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect } from "react";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Toolbar } from "@/components/toolbar";
import { WorkflowSettingsPanel } from "@/components/workflow-settings-panel";
import { WorkflowShell } from "@/components/workflow-shell";
import { COMMANDS, EVENTS, invokeCommand, listenEvent } from "@/lib/tauri";
import { getWorkflow, type Workflow } from "@/lib/workflows";
import { selectWorkflowFileCount, useStore } from "@/store";

type WorkflowPageProps = {
  workflow: Workflow;
};

export function WorkflowPage({ workflow }: WorkflowPageProps) {
  const fileCount = useStore((state) => selectWorkflowFileCount(state, workflow));
  const addFiles = useStore((s) => s.addFiles);
  const config = getWorkflow(workflow);

  const handleDropPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) {
        return;
      }
      try {
        const expanded = await invokeCommand<string[]>(COMMANDS.expandPaths, {
          paths,
        });
        addFiles(workflow, expanded.length > 0 ? expanded : paths);
      } catch (err) {
        error(`drag-drop expand failed: ${String(err)}`);
        addFiles(workflow, paths);
      }
    },
    [addFiles, workflow],
  );

  useEffect(() => {
    const unlisten = listenEvent<{ paths: string[] }>(EVENTS.dragDrop, (event) => {
      void handleDropPaths(event.paths);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleDropPaths]);

  return (
    <WorkflowShell title={config.title}>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {fileCount === 0 ? <DropZone workflow={workflow} /> : <FileList workflow={workflow} />}
          <Toolbar workflow={workflow} />
        </div>
        <WorkflowSettingsPanel workflow={workflow} />
      </div>
    </WorkflowShell>
  );
}
