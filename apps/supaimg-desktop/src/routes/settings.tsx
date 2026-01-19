import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { cn } from "@repo/ui/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useStore } from "@/store";

const HOMEPAGE_URL = "https://supaimg.app";

type SettingsTab = "general" | "about";
const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "about", label: "About" },
];

export const Route = createFileRoute("/settings")({
  validateSearch: (search) => ({
    tab: search.tab === "about" ? search.tab : "general",
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const launchAtLogin = useStore((s) => s.settings.launchAtLogin);
  const showMenuBarIcon = useStore((s) => s.settings.showMenuBarIcon);
  const autoUpdate = useStore((s) => s.settings.autoUpdate);
  const analyticsTracking = useStore((s) => s.settings.analyticsTracking);
  const setLaunchAtLogin = useStore((s) => s.setLaunchAtLogin);
  const setShowMenuBarIcon = useStore((s) => s.setShowMenuBarIcon);
  const setAutoUpdate = useStore((s) => s.setAutoUpdate);
  const setAnalyticsTracking = useStore((s) => s.setAnalyticsTracking);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then((value) => setVersion(value))
      .catch(() => setVersion(null));
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate({ to: "/" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [navigate]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-medium">Settings</div>
        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
          Close
        </Button>
      </div>
      <div className="border-b border-border px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {SETTINGS_TABS.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => navigate({ to: "/settings", search: { tab: item.id } })}
              className={cn(
                "border border-transparent text-xs",
                tab === item.id && "border-border bg-muted text-foreground",
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {tab === "general" ? (
          <SettingsGeneral
            autoUpdate={autoUpdate}
            analyticsTracking={analyticsTracking}
            launchAtLogin={launchAtLogin}
            showMenuBarIcon={showMenuBarIcon}
            onToggleAutoUpdate={setAutoUpdate}
            onToggleAnalyticsTracking={setAnalyticsTracking}
            onToggleLaunchAtLogin={setLaunchAtLogin}
            onToggleMenuBarIcon={setShowMenuBarIcon}
          />
        ) : null}
        {tab === "about" ? (
          <SettingsAbout
            version={version}
            homepageUrl={HOMEPAGE_URL}
            onOpenHomepage={() => openUrl(HOMEPAGE_URL)}
          />
        ) : null}
      </div>
    </div>
  );
}

function SettingsGeneral({
  autoUpdate,
  analyticsTracking,
  launchAtLogin,
  showMenuBarIcon,
  onToggleAutoUpdate,
  onToggleAnalyticsTracking,
  onToggleLaunchAtLogin,
  onToggleMenuBarIcon,
}: {
  autoUpdate: boolean;
  analyticsTracking: boolean;
  launchAtLogin: boolean;
  showMenuBarIcon: boolean;
  onToggleAutoUpdate: (value: boolean) => void;
  onToggleAnalyticsTracking: (value: boolean) => void;
  onToggleLaunchAtLogin: (value: boolean) => void;
  onToggleMenuBarIcon: (value: boolean) => void;
}) {
  return (
    <div className="w-full">
      <div className="divide-y divide-border rounded border border-border">
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div>
            <label htmlFor="auto-update" className="block text-sm text-foreground">
              Auto update
            </label>
            <div className="text-xs text-muted-foreground">Install new versions automatically</div>
          </div>
          <Checkbox
            id="auto-update"
            checked={autoUpdate}
            onCheckedChange={(checked) => {
              onToggleAutoUpdate(Boolean(checked));
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div>
            <label htmlFor="analytics-tracking" className="block text-sm text-foreground">
              Analytics tracking
            </label>
            <div className="text-xs text-muted-foreground">Crash logs only, no user data</div>
          </div>
          <Checkbox
            id="analytics-tracking"
            checked={analyticsTracking}
            onCheckedChange={(checked) => {
              onToggleAnalyticsTracking(Boolean(checked));
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div>
            <label htmlFor="launch-at-login" className="block text-sm text-foreground">
              Launch at Login
            </label>
            <div className="text-xs text-muted-foreground">Start SupaIMG when you sign in</div>
          </div>
          <Checkbox
            id="launch-at-login"
            checked={launchAtLogin}
            onCheckedChange={(checked) => {
              onToggleLaunchAtLogin(Boolean(checked));
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div>
            <label htmlFor="show-menu-bar" className="block text-sm text-foreground">
              Show menu bar icon
            </label>
            <div className="text-xs text-muted-foreground">Keep SupaIMG in the menu bar</div>
          </div>
          <Checkbox
            id="show-menu-bar"
            checked={showMenuBarIcon}
            onCheckedChange={(checked) => {
              onToggleMenuBarIcon(Boolean(checked));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SettingsAbout({
  version,
  homepageUrl,
  onOpenHomepage,
}: {
  version: string | null;
  homepageUrl: string;
  onOpenHomepage: () => void;
}) {
  return (
    <div className="w-full">
      <div className="divide-y divide-border rounded border border-border">
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div className="text-sm text-foreground">Version</div>
          <div className="text-xs text-muted-foreground">{version ?? "—"}</div>
        </div>
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div>
            <div className="text-sm text-foreground">Homepage</div>
            <div className="text-xs text-muted-foreground">{homepageUrl}</div>
          </div>
          <Button variant="outline" onClick={onOpenHomepage}>
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}
