import { Toaster } from "@repo/ui/components/ui/sonner";
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { error } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { ProgressView } from "@/components/progress-view";
import { ThemeProvider } from "@/components/theme-provider";
import {
  dismissUpdateDownloadToast,
  resetUpdateDownloadToast,
  showUpdateDownloadToast,
} from "@/components/update-toast";
import { EVENTS, isTauri, listenEvent } from "@/lib/tauri";
import {
  clearUpdateCache,
  downloadUpdateToCache,
  getCachedUpdateVersion,
  installCachedUpdate,
} from "@/lib/update";
import { useStore } from "@/store";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const platform = useStore((s) => s.platform);
  const autoUpdate = useStore((s) => s.settings.autoUpdate);
  const installingUpdateVersion = useStore((s) => s.installingUpdateVersion);
  const setCachedUpdateVersion = useStore((s) => s.setCachedUpdateVersion);
  const setInstallingUpdateVersion = useStore((s) => s.setInstallingUpdateVersion);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!autoUpdate) {
      void clearUpdateCache().finally(() => {
        if (cancelled) return;
        setCachedUpdateVersion(null);
        setInstallingUpdateVersion(null);
      });
      return () => {
        cancelled = true;
      };
    }

    const sync = async () => {
      const existing = await getCachedUpdateVersion();
      if (cancelled) return;
      if (existing) {
        setInstallingUpdateVersion(existing);
        setCachedUpdateVersion(null);
        let installed = false;
        try {
          await installCachedUpdate(existing);
          installed = true;
        } catch {
          await clearUpdateCache();
          if (!cancelled) {
            setCachedUpdateVersion(null);
            setInstallingUpdateVersion(null);
          }
        }
        if (cancelled) return;
        if (installed) {
          setInstallingUpdateVersion(null);
          return;
        }
      }

      const downloaded = await downloadUpdateToCache();
      if (cancelled) return;
      if (downloaded) {
        setCachedUpdateVersion(downloaded);
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [autoUpdate, setCachedUpdateVersion, setInstallingUpdateVersion]);

  useEffect(() => {
    if (!autoUpdate) {
      setUpdateDownloadProgress(null);
      dismissUpdateDownloadToast();
      return;
    }
    if (!isTauri() || import.meta.env.DEV) return;
    let active = true;
    let unlisten: (() => void) | null = null;
    listenEvent<{ progress: number }>(EVENTS.updateDownloadProgress, (event) => {
      if (!active) return;
      const value = Math.max(0, Math.min(1, event.progress));
      setUpdateDownloadProgress(value);
    })
      .then((off) => {
        if (!active) {
          off();
          return;
        }
        unlisten = off;
      })
      .catch((err) => {
        void error(`update download listen failed: ${String(err)}`);
      });
    return () => {
      active = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [autoUpdate]);

  useEffect(() => {
    if (updateDownloadProgress === null) return;
    if (updateDownloadProgress <= 0) {
      resetUpdateDownloadToast();
    }
    showUpdateDownloadToast({ progress: updateDownloadProgress });
    if (updateDownloadProgress >= 1) {
      dismissUpdateDownloadToast();
      resetUpdateDownloadToast();
      setUpdateDownloadProgress(null);
    }
  }, [updateDownloadProgress]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== ",") return;
      const isMac =
        platform === "macos" ||
        (platform === "unknown" &&
          typeof navigator !== "undefined" &&
          /macos|macintosh|mac os/i.test(navigator.platform));
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier) return;
      event.preventDefault();
      navigate({ to: "/settings", search: { tab: "general" } });
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [navigate, platform]);

  const content = installingUpdateVersion ? (
    <div className="h-dvh bg-background text-foreground">
      <ProgressView label={`Applying update to ${installingUpdateVersion}`} />
    </div>
  ) : (
    <Outlet />
  );

  return (
    <ThemeProvider defaultTheme="system" storageKey="supaimg-ui-theme">
      {content}
      <Toaster />
    </ThemeProvider>
  );
}
