import { Button } from "@repo/ui/components/ui/button";
import { Slider } from "@repo/ui/components/ui/slider";
import { useImageCompareDrag } from "@repo/ui/lib/use-image-compare";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as React from "react";
import { outputPath } from "@/lib/file-utils";
import { formatBytes } from "@/lib/format";
import { convertFormatExtension } from "@/lib/workflows";
import type { FileItem } from "@/store";

type ImageCompareModalProps = {
  file: FileItem;
  onClose?: () => void;
  originalSrc?: string;
  outputSrc?: string;
  variant?: "modal" | "inline";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ImageCompareModal({
  file,
  onClose,
  originalSrc,
  outputSrc,
  variant = "modal",
}: ImageCompareModalProps) {
  const isModal = variant === "modal";
  const [zoom, setZoom] = React.useState(1);
  const { containerRef, handleMouseDown, handleTouchStart, resetSplit } = useImageCompareDrag({
    initialSplit: 50,
  });

  const resolvedOriginalSrc = React.useMemo(
    () => originalSrc ?? convertFileSrc(file.path),
    [originalSrc, file.path],
  );
  const resolvedOutputSrc = React.useMemo(() => {
    const extension =
      file.workflow === "convert" && file.outputFormat
        ? convertFormatExtension(file.outputFormat)
        : file.outputFormat;
    return outputSrc ?? convertFileSrc(outputPath(file.path, file.workflow, extension));
  }, [outputSrc, file.outputFormat, file.path, file.workflow]);

  React.useEffect(() => {
    if (!file.id) return;
    resetSplit(50);
    setZoom(1);
  }, [file.id, resetSplit]);

  React.useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [isModal, onClose]);

  const originalLabel = file.originalSize > 0 ? formatBytes(file.originalSize) : "-";
  const outputLabel = file.outputSize !== undefined ? formatBytes(file.outputSize) : "-";
  const showSize = file.workflow !== "remove_bg";
  const sizeLabel =
    file.outputSize !== undefined ? `${originalLabel} -> ${outputLabel}` : originalLabel;

  const rootClassName = isModal
    ? "fixed inset-0 z-50 bg-background text-foreground"
    : "relative w-full overflow-hidden rounded border border-border bg-card text-foreground";
  const shellClassName = isModal
    ? "relative flex h-full w-full flex-col"
    : "relative flex w-full min-h-[420px] flex-col";
  const imageClassName = isModal
    ? "block max-h-[82vh] max-w-[90vw] object-contain"
    : "block max-h-[360px] max-w-full object-contain";

  const content = (
    <>
      {isModal && onClose ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-4 top-4 z-10 border border-border text-foreground/70 hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          x
        </Button>
      ) : null}

      <div className="relative flex-1 overflow-auto px-6 pb-6 pt-4">
        <div className="relative mx-auto flex min-h-full min-w-full items-center justify-center">
          <div
            ref={containerRef}
            className="relative select-none touch-none"
            style={{
              ["--split" as string]: "50%",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            role="slider"
            tabIndex={0}
            aria-label="Image comparison"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={50}
          >
            <img
              src={resolvedOutputSrc}
              alt={`${file.name} output`}
              className={imageClassName}
              draggable={false}
            />
            <img
              src={resolvedOriginalSrc}
              alt={`${file.name} original`}
              className={`${imageClassName} absolute inset-0`}
              style={{
                clipPath: "inset(0 calc(100% - var(--split)) 0 0)",
              }}
              draggable={false}
            />
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-none border border-border bg-background/80 px-2 py-1 text-[11px] uppercase tracking-wide text-foreground/80">
              Before
            </div>
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-none border border-border bg-background/80 px-2 py-1 text-[11px] uppercase tracking-wide text-foreground/80">
              After
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/60"
              style={{ left: "var(--split)" }}
            />
            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: "var(--split)" }}
            >
              <div className="flex h-7 w-5 items-center justify-center rounded-none border border-border bg-background/70 text-foreground/90">
                <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2.8} className="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4 text-xs">
        <div className="pointer-events-auto rounded-none border border-border bg-background/80 px-3 py-2 shadow-sm">
          <div className="text-sm font-medium text-foreground">{file.name}</div>
          {showSize ? <div className="text-muted-foreground">{sizeLabel}</div> : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-none border border-border bg-background/80 px-3 py-2 shadow-sm">
          <span className="text-muted-foreground">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.1}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              setZoom(clamp(next ?? 1, 1, 4));
            }}
            className="w-28"
          />
          <span className="tabular-nums text-foreground">{zoom.toFixed(1)}x</span>
        </div>
      </div>
    </>
  );

  return isModal ? (
    <div className={rootClassName}>
      <div className={shellClassName} role="dialog" aria-modal="true" aria-label="Image comparison">
        {content}
      </div>
    </div>
  ) : (
    <div className={rootClassName}>
      <div className={shellClassName}>{content}</div>
    </div>
  );
}
