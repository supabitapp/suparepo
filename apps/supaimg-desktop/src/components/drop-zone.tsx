import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { COMMANDS, EVENTS, invokeCommand, listenEvent } from "@/lib/tauri";
import { getWorkflow, type Workflow } from "@/lib/workflows";
import { useStore } from "@/store";
import { LayersIcon, type LayersIconHandle } from "./layers-icon";

type DropZoneProps = {
  workflow: Workflow;
};

const formatCount = (count: number, label: string) =>
  `${count} ${count === 1 ? label : `${label}s`}`;

export function DropZone({ workflow }: DropZoneProps) {
  const addFiles = useStore((s) => s.addFiles);
  const convertOutputFormat = useStore((s) => s.settings.workflowSettings.convert.outputFormat);
  const platform = useStore((s) => s.platform);
  const iconRef = useRef<LayersIconHandle>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounts, setDragCounts] = useState<{
    files: number;
    folders: number;
    skipped: number;
  } | null>(null);
  const config = getWorkflow(workflow);
  const isMac =
    platform === "macos" ||
    (platform === "unknown" &&
      typeof navigator !== "undefined" &&
      /macos|macintosh|mac os/i.test(navigator.platform));
  const shortcutLabel = isMac ? "⌘O" : "Ctrl+O";

  const handleSelectFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: [...config.inputExtensions],
        },
      ],
    });
    if (selected) {
      addFiles(workflow, Array.isArray(selected) ? selected : [selected]);
    }
  }, [addFiles, config.inputExtensions, workflow]);

  const updateDragCounts = useCallback(
    async (paths?: string[]) => {
      if (!paths || paths.length === 0) {
        setDragCounts(null);
        return;
      }
      try {
        const payload =
          workflow === "convert" ? { paths, workflow, convertOutputFormat } : { paths, workflow };
        const counts = await invokeCommand<{
          fileCount: number;
          folderCount: number;
          skippedCount: number;
        }>(COMMANDS.countDragItems, payload);
        setDragCounts({
          files: counts.fileCount,
          folders: counts.folderCount,
          skipped: counts.skippedCount,
        });
      } catch {
        setDragCounts({ files: paths.length, folders: 0, skipped: 0 });
      }
    },
    [workflow, convertOutputFormat],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "o") {
        e.preventDefault();
        handleSelectFiles();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectFiles, isMac]);

  useEffect(() => {
    const unlistenEnter = listenEvent<{ paths?: string[] }>(EVENTS.dragEnter, (event) => {
      setIsDragging(true);
      iconRef.current?.startAnimation();
      void updateDragCounts(event.paths);
    });
    const unlistenLeave = listenEvent(EVENTS.dragLeave, () => {
      setIsDragging(false);
      setDragCounts(null);
      iconRef.current?.stopAnimation();
    });
    const unlistenDrop = listenEvent(EVENTS.dragDrop, () => {
      setIsDragging(false);
      setDragCounts(null);
      iconRef.current?.stopAnimation();
    });

    return () => {
      unlistenEnter.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
      unlistenDrop.then((fn) => fn());
    };
  }, [updateDragCounts]);

  const dragMessage = isDragging
    ? dragCounts
      ? `Release to ${config.actionLabel} ${formatCount(
          dragCounts.folders,
          "folder",
        )}, ${formatCount(
          Math.max(0, dragCounts.files - dragCounts.skipped),
          "file",
        )}${dragCounts.skipped > 0 ? ` (${dragCounts.skipped} skipped)` : ""}`
      : `Release to ${config.actionLabel} files`
    : "Drop images here";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <LayersIcon ref={iconRef} className="text-muted-foreground" size={64} />
      <p className="text-sm">{dragMessage}</p>
      <div
        aria-hidden={isDragging}
        className={cn(
          "flex flex-col items-center gap-2 transition-opacity duration-200",
          isDragging && "opacity-0 pointer-events-none",
        )}
      >
        <p className="text-xs text-muted-foreground">or</p>
        <Button
          variant="outline"
          onClick={handleSelectFiles}
          tabIndex={isDragging ? -1 : undefined}
        >
          Select Files <kbd className="ml-2 text-xs text-muted-foreground">{shortcutLabel}</kbd>
        </Button>
      </div>
    </div>
  );
}
