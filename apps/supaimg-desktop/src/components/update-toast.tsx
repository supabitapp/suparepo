import { Button } from "@repo/ui/components/ui/button";
import { Progress } from "@repo/ui/components/ui/progress";
import { toast } from "@repo/ui/lib/toast";

type UpdateToastOptions = {
  version: string;
  onRestart?: () => void;
  id?: string;
  duration?: number;
};

type UpdateDownloadToastOptions = {
  progress: number | null;
  id?: string;
};

const dismissedDownloadToasts = new Set<string>();

export const showUpdateToast = ({ version, onRestart, id, duration }: UpdateToastOptions) => {
  const toastId = id ?? `update-${version}`;
  toast.custom(
    (innerId) => (
      <div className="relative w-[520px] max-w-[calc(100vw-2rem)]">
        <div className="relative flex items-center gap-6 rounded-none border border-border bg-card px-6 py-4 pr-12 text-card-foreground shadow-[0_14px_28px_rgba(0,0,0,0.2)] ring-1 ring-foreground/10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => toast.dismiss(innerId)}
            aria-label="Dismiss update notification"
          >
            x
          </Button>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold">New update available</div>
            <div className="text-xs text-muted-foreground">Restart to use the latest.</div>
          </div>
          <Button
            className="ml-auto px-5 text-xs font-semibold"
            onClick={() => {
              toast.dismiss(innerId);
              onRestart?.();
            }}
          >
            Restart
          </Button>
        </div>
      </div>
    ),
    {
      id: toastId,
      duration: duration ?? 5000,
      unstyled: true,
    },
  );
};

export const showUpdateDownloadToast = ({ progress, id }: UpdateDownloadToastOptions) => {
  const toastId = id ?? "update-download";
  if (dismissedDownloadToasts.has(toastId)) return;
  const clampedProgress = progress === null ? null : Math.max(0, Math.min(1, progress)) * 100;
  const progressLabel = clampedProgress === null ? null : `${Math.round(clampedProgress)}%`;
  toast.custom(
    (innerId) => (
      <div className="relative w-[520px] max-w-[calc(100vw-2rem)]">
        <div className="relative flex items-start gap-4 rounded-none border border-border bg-card px-6 py-4 pr-12 text-card-foreground shadow-[0_14px_28px_rgba(0,0,0,0.2)] ring-1 ring-foreground/10">
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-1 top-1 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              dismissedDownloadToasts.add(toastId);
              toast.dismiss(innerId);
            }}
            aria-label="Dismiss update download"
          >
            x
          </Button>
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">Downloading update</div>
              {progressLabel ? (
                <span className="text-xs tabular-nums text-muted-foreground">{progressLabel}</span>
              ) : null}
            </div>
            <Progress className="w-full" value={clampedProgress ?? null} />
            <div className="text-xs text-muted-foreground">
              You can keep working while this downloads.
            </div>
          </div>
        </div>
      </div>
    ),
    {
      id: toastId,
      duration: Infinity,
      unstyled: true,
    },
  );
};

export const dismissUpdateToast = (versionOrId: string) => {
  toast.dismiss(versionOrId);
  toast.dismiss(`update-${versionOrId}`);
};

export const dismissUpdateDownloadToast = (id?: string) => {
  toast.dismiss(id ?? "update-download");
};

export const resetUpdateDownloadToast = (id?: string) => {
  const toastId = id ?? "update-download";
  dismissedDownloadToasts.delete(toastId);
  toast.dismiss(toastId);
};
