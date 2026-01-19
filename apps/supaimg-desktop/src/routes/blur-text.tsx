import { Button } from "@repo/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useState } from "react";
import { ProgressView } from "@/components/progress-view";
import { WorkflowPage } from "@/components/workflow-page";
import { WorkflowShell } from "@/components/workflow-shell";
import { COMMANDS, EVENTS, invokeCommand, isTauri, listenEvent } from "@/lib/tauri";
import { getWorkflow } from "@/lib/workflows";

export const Route = createFileRoute("/blur-text")({
  component: BlurTextPage,
});

function BlurTextPage() {
  const [ready, setReady] = useState(!isTauri());
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const config = getWorkflow("blur_text");

  const startDownload = useCallback(() => {
    setAttempt((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      setReady(true);
      return;
    }
    let active = true;
    let unlisten: (() => void) | null = null;
    setReady(false);
    setDownloadError(null);
    setProgress(attempt > 0 ? 0 : null);

    listenEvent<{ progress: number }>(EVENTS.textModelDownloadProgress, (event) => {
      if (!active) return;
      setProgress(Math.max(0, Math.min(1, event.progress)));
    })
      .then((off) => {
        if (!active) {
          off();
          return;
        }
        unlisten = off;
      })
      .catch((err) => {
        void error(`text model download listen failed: ${String(err)}`);
      });

    void invokeCommand(COMMANDS.prepareBlurTextModels)
      .then(() => {
        if (!active) return;
        setProgress(1);
        setReady(true);
      })
      .catch((err) => {
        if (!active) return;
        const message = String(err);
        void error(`text model download failed: ${message}`);
        setDownloadError(message);
      });

    return () => {
      active = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [attempt]);

  if (ready) {
    return <WorkflowPage workflow="blur_text" />;
  }

  const progressValue = progress === null ? undefined : progress * 100;

  return (
    <WorkflowShell title={config.title}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <ProgressView
          label={downloadError ? "Download failed" : "Downloading text detection model"}
          progress={downloadError ? undefined : progressValue}
        />
        {downloadError ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs text-muted-foreground">{downloadError}</span>
            <Button variant="outline" onClick={startDownload}>
              Retry download
            </Button>
          </div>
        ) : null}
      </div>
    </WorkflowShell>
  );
}
