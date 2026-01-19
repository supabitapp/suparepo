import { Button } from "@repo/ui/components/ui/button";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { dismissUpdateToast, showUpdateToast } from "@/components/update-toast";
import { isTauri } from "@/lib/tauri";
import { clearUpdateCache, downloadUpdateToCache, installCachedUpdate } from "@/lib/update";
import { useStore } from "@/store";

type MainToolbarProps = {
  label?: string;
  showSettings?: boolean;
  updateVersion?: string | null;
  embedded?: boolean;
};

export function MainToolbar({
  label,
  showSettings = true,
  updateVersion,
  embedded = false,
}: MainToolbarProps) {
  const navigate = useNavigate();
  const autoUpdate = useStore((s) => s.settings.autoUpdate);
  const cachedUpdateVersion = useStore((s) => s.cachedUpdateVersion);
  const setCachedUpdateVersion = useStore((s) => s.setCachedUpdateVersion);
  const setInstallingUpdateVersion = useStore((s) => s.setInstallingUpdateVersion);
  const effectiveUpdateVersion =
    updateVersion !== undefined ? updateVersion : autoUpdate ? cachedUpdateVersion : null;
  const handleUpdate = useCallback(() => {
    if (updateVersion !== undefined) return;
    if (!isTauri() || import.meta.env.DEV) return;
    if (!cachedUpdateVersion) return;
    setCachedUpdateVersion(null);
    setInstallingUpdateVersion(cachedUpdateVersion);
    void installCachedUpdate(cachedUpdateVersion).catch(async () => {
      await clearUpdateCache();
      setInstallingUpdateVersion(null);
      const downloaded = await downloadUpdateToCache();
      if (downloaded) {
        setCachedUpdateVersion(downloaded);
      }
    });
  }, [cachedUpdateVersion, setCachedUpdateVersion, setInstallingUpdateVersion, updateVersion]);

  useEffect(() => {
    if (!effectiveUpdateVersion) return;
    if (updateVersion === undefined && (!isTauri() || import.meta.env.DEV)) return;
    showUpdateToast({
      version: effectiveUpdateVersion,
      onRestart: handleUpdate,
    });

    return () => {
      dismissUpdateToast(effectiveUpdateVersion);
    };
  }, [effectiveUpdateVersion, handleUpdate, updateVersion]);

  const content = (
    <div
      className={
        embedded
          ? "flex min-h-12 items-center gap-3 px-6 py-3"
          : "mx-auto flex min-h-12 max-w-7xl items-center gap-3 px-6 py-3"
      }
    >
      {label ? <div className="text-xs font-medium text-foreground">{label}</div> : null}
      {showSettings ? (
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => navigate({ to: "/settings", search: { tab: "general" } })}
          aria-label="Open settings"
        >
          <HugeiconsIcon icon={Settings01Icon} className="size-4" />
        </Button>
      ) : null}
    </div>
  );

  return embedded ? content : <div className="border-t border-border">{content}</div>;
}
