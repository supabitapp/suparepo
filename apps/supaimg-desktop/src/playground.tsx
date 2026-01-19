import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "@/components/data-table";
import { columnsForWorkflow } from "@/components/file-columns";
import { ImageCompareModal } from "@/components/image-compare-modal";
import { LayersIcon, type LayersIconHandle } from "@/components/layers-icon";
import { MainToolbar } from "@/components/main-toolbar";
import { ProgressView } from "@/components/progress-view";
import { Toolbar } from "@/components/toolbar";
import {
  dismissUpdateDownloadToast,
  resetUpdateDownloadToast,
  showUpdateDownloadToast,
  showUpdateToast,
} from "@/components/update-toast";
import { type FileItem, useStore } from "@/store";

const MOCK_FILES: FileItem[] = [
  {
    id: "1",
    path: "/photos/vacation.png",
    name: "vacation.png",
    workflow: "compress",
    originalSize: 2_500_000,
    status: "pending",
  },
  {
    id: "2",
    path: "/photos/portrait.jpg",
    name: "portrait.jpg",
    workflow: "compress",
    originalSize: 1_800_000,
    status: "processing",
    progress: 0.45,
  },
  {
    id: "3",
    path: "/playground-compare.jpg",
    name: "playground-compare.jpg",
    workflow: "compress",
    originalSize: 378_799,
    outputSize: 135_980,
    status: "done",
  },
  {
    id: "4",
    path: "/photos/broken.png",
    name: "broken.png",
    workflow: "compress",
    originalSize: 500_000,
    status: "error",
    error: {
      code: "io_error",
      message: "Failed to read file: permission denied",
    },
  },
  {
    id: "5",
    path: "/photos/grew.png",
    name: "grew.png",
    workflow: "compress",
    originalSize: 100_000,
    outputSize: 120_000,
    status: "done",
  },
];
const columns = columnsForWorkflow("compress");
const canCompare = (file: FileItem) => file.status === "done";

function Section({
  title,
  children,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-4 pt-4">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h2>
      </div>
      <div className={cn("px-4 pb-4", contentClassName)}>{children}</div>
    </div>
  );
}

function LayersIconPlayground() {
  const iconRef = useRef<LayersIconHandle>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <LayersIcon className="text-muted-foreground" size={64} />
        <span className="text-xs text-muted-foreground">Hover me</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LayersIcon ref={iconRef} className="text-muted-foreground" size={64} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (isAnimating) {
              iconRef.current?.stopAnimation();
            } else {
              iconRef.current?.startAnimation();
            }
            setIsAnimating(!isAnimating);
          }}
        >
          {isAnimating ? "Stop" : "Animate"}
        </Button>
      </div>
    </div>
  );
}

function ResultToolbarPlayground() {
  useEffect(() => {
    const { filesById, fileOrder } = useStore.getState();
    const nextFilesById = Object.fromEntries(MOCK_FILES.map((file) => [file.id, file]));
    const nextFileOrder = MOCK_FILES.map((file) => file.id);
    useStore.setState({
      filesById: nextFilesById,
      fileOrder: nextFileOrder,
    });
    return () => {
      useStore.setState({ filesById, fileOrder });
    };
  }, []);

  return <Toolbar workflow="compress" />;
}

function DropZonePlayground() {
  return (
    <div className="flex gap-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded border border-border py-8">
        <LayersIcon className="text-muted-foreground" size={48} />
        <p className="text-sm">Drop images here</p>
        <p className="text-xs text-muted-foreground">or</p>
        <Button variant="outline">
          Select Files <kbd className="ml-2 text-xs text-muted-foreground">⌘O</kbd>
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded border-2 border-dashed border-primary/50 bg-primary/5 py-8">
        <LayersIcon className="text-primary" size={48} />
        <p className="text-sm">Release to compress 2 folders, 15 files</p>
      </div>
    </div>
  );
}

export function Playground() {
  const defaultCompareFile = MOCK_FILES.find((file) => file.status === "done") ?? null;
  const updatePreviewVersion = "1.2.3";
  const updateDownloadToastId = "playground-update-download";
  const [activeFileId, setActiveFileId] = useState<string | null>(defaultCompareFile?.id ?? null);
  const activeFile = useMemo(
    () => MOCK_FILES.find((file) => file.id === activeFileId) ?? null,
    [activeFileId],
  );

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Component Playground</h1>
        <Link to="/">
          <Button variant="outline" size="sm">
            ← Back to App
          </Button>
        </Link>
      </div>

      <Section title="LayersIcon">
        <LayersIconPlayground />
      </Section>

      <Section title="DropZone States">
        <DropZonePlayground />
      </Section>

      <Section title="Update View">
        <div className="h-48">
          <ProgressView progress={30} label="Applying update to 0.9.4" />
        </div>
      </Section>

      <Section title="Update Toast">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showUpdateToast({
                version: updatePreviewVersion,
                id: crypto.randomUUID(),
              })
            }
          >
            Show update toast
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showUpdateDownloadToast({
                progress: 0.12,
                id: updateDownloadToastId,
              })
            }
          >
            Download 12%
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showUpdateDownloadToast({
                progress: 0.58,
                id: updateDownloadToastId,
              })
            }
          >
            Download 58%
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              showUpdateDownloadToast({
                progress: 0.94,
                id: updateDownloadToastId,
              })
            }
          >
            Download 94%
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissUpdateDownloadToast(updateDownloadToastId)}
          >
            Dismiss download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetUpdateDownloadToast(updateDownloadToastId)}
          >
            Reset download
          </Button>
          <span className="text-xs text-muted-foreground">Appears bottom-right</span>
        </div>
      </Section>

      <Section title="Main Toolbar" contentClassName="px-0 pb-0">
        <div className="border-t border-border">
          <MainToolbar embedded />
        </div>
      </Section>

      <Section title="Result Toolbar" contentClassName="px-0 pb-0">
        <ResultToolbarPlayground />
      </Section>

      <Section title="FileList (DataTable)">
        <div className="h-[300px] overflow-hidden rounded border border-border">
          <DataTable
            columns={columns}
            data={MOCK_FILES}
            onRowClick={(file) => {
              if (canCompare(file)) {
                setActiveFileId(file.id);
              }
            }}
            getRowClassName={(file) =>
              canCompare(file) ? "cursor-pointer hover:bg-muted/30" : "cursor-default"
            }
          />
        </div>
      </Section>

      <Section title="Comparing Image View">
        {activeFile ? (
          <ImageCompareModal
            variant="inline"
            file={activeFile}
            originalSrc="/playground-compare.jpg"
            outputSrc="/playground-compare_compressed.jpg"
          />
        ) : (
          <div className="rounded border border-border p-4 text-xs text-muted-foreground">
            Select a completed image row to preview.
          </div>
        )}
      </Section>
    </div>
  );
}
