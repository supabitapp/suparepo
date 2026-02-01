import logoUrl from "@repo/ui/supaimg/logo.png";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { useImageCompareDrag } from "@repo/ui/supaimg/use-image-compare";
import {
  Apple,
  AppWindow,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Lock,
  type LucideIcon,
  Moon,
  Paintbrush,
  Sun,
} from "@repo/ui/icons/lucide";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const UPDATE_JSON_URL = "https://supaimg.app/appcast/update.json";

type Platform = "macos" | "windows" | "unknown";
type DownloadInfo = { version: string; macosUrl: string; windowsUrl: string };

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "unknown";
}

function useDownloadInfo(): { info: DownloadInfo | null; platform: Platform } {
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const platform = detectPlatform();

  useEffect(() => {
    fetch(UPDATE_JSON_URL)
      .then((res) => res.json())
      .then((data: { version: string }) => {
        const base = `https://supaimg.app/appcast/supaimg/v${data.version}`;
        setInfo({
          version: data.version,
          macosUrl: `${base}/supaimg_aarch64.dmg`,
          windowsUrl: `${base}/supaimg_x64.msi`,
        });
      })
      .catch(() => {});
  }, []);

  return { info, platform };
}

function getPrimaryDownload(
  platform: Platform,
  info: DownloadInfo | null,
): { url: string | undefined; icon: LucideIcon; label: string } {
  if (platform === "windows") {
    return {
      url: info?.windowsUrl,
      icon: AppWindow,
      label: "Download for Windows",
    };
  }
  return {
    url: info?.macosUrl,
    icon: Apple,
    label: "Download for macOS",
  };
}

function DownloadButtons({
  info,
  platform,
  centered = false,
}: {
  info: DownloadInfo | null;
  platform: Platform;
  centered?: boolean;
}) {
  const primary = getPrimaryDownload(platform, info);
  const PrimaryIcon = primary.icon;
  const containerClass = centered ? "flex flex-col items-center gap-3" : "flex flex-col gap-3";
  const rowClass = centered ? "flex flex-wrap justify-center gap-3" : "flex flex-wrap gap-3";

  return (
    <div className={containerClass}>
      <div className={rowClass}>
        <a href={primary.url ?? "#"}>
          <Button
            size="lg"
            disabled={!info}
            className="cursor-pointer gap-2 text-xs uppercase tracking-wider"
          >
            <PrimaryIcon className="size-4" />
            {primary.label}
          </Button>
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!info}
            className="inline-flex h-9 cursor-pointer items-center gap-2 border border-input bg-background px-4 text-xs uppercase tracking-wider hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            Other Platforms
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {platform !== "macos" && (
              <DropdownMenuItem
                onClick={() => info?.macosUrl && window.open(info.macosUrl, "_self")}
              >
                <Apple className="size-4" />
                macOS (Apple Silicon)
              </DropdownMenuItem>
            )}
            {platform !== "windows" && (
              <DropdownMenuItem
                onClick={() => info?.windowsUrl && window.open(info.windowsUrl, "_self")}
              >
                <AppWindow className="size-4" />
                Windows (64-bit)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled className="text-muted-foreground">
              Linux (coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button
        size="lg"
        className="w-fit cursor-pointer bg-chart-3 text-xs uppercase tracking-wider text-white hover:bg-chart-3/80"
        onClick={() => alert("Free for beta while I'm working on a license server")}
      >
        Buy SupaIMG
      </Button>
    </div>
  );
}

type Workflow = {
  id: string;
  name: string;
  tagline: string;
  formats: string[];
  color: string;
};

const WORKFLOWS: Workflow[] = [
  {
    id: "remove-bg",
    name: "Remove Background",
    tagline: "ML-powered extraction",
    formats: ["Any → PNG"],
    color: "chart-3",
  },
  {
    id: "blur-text",
    name: "Blur Text",
    tagline: "Sensitive text redaction",
    formats: ["JPG", "PNG", "WEBP"],
    color: "chart-2",
  },
  {
    id: "compress",
    name: "Compress",
    tagline: "Lossless compression",
    formats: ["JPEG", "PNG", "GIF", "WEBP"],
    color: "chart-1",
  },
  {
    id: "convert",
    name: "Convert to JPG",
    tagline: "Bulk format conversion",
    formats: ["PNG → JPG", "GIF → JPG", "WEBP → JPG"],
    color: "chart-4",
  },
];

const COMING_SOON = ["Resize", "Crop", "Convert from JPG", "Upscale", "Watermark", "Blur Face"];

function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}

type DemoFile = {
  name: string;
  originalSize: number;
  outputSize: number;
  status: "pending" | "processing" | "done";
  progress: number;
};

const COMPRESS_FILES: DemoFile[] = [
  {
    name: "hero-banner.png",
    originalSize: 4521984,
    outputSize: 1892352,
    status: "pending",
    progress: 0,
  },
  {
    name: "product-shot.jpg",
    originalSize: 2867200,
    outputSize: 983040,
    status: "pending",
    progress: 0,
  },
  {
    name: "team-photo.webp",
    originalSize: 1048576,
    outputSize: 524288,
    status: "pending",
    progress: 0,
  },
  {
    name: "animation.gif",
    originalSize: 3355443,
    outputSize: 2097152,
    status: "pending",
    progress: 0,
  },
];

const CONVERT_FILES: DemoFile[] = [
  {
    name: "screenshot.png",
    originalSize: 2097152,
    outputSize: 716800,
    status: "pending",
    progress: 0,
  },
  {
    name: "icon-set.webp",
    originalSize: 524288,
    outputSize: 204800,
    status: "pending",
    progress: 0,
  },
  {
    name: "banner.gif",
    originalSize: 1572864,
    outputSize: 409600,
    status: "pending",
    progress: 0,
  },
  {
    name: "thumbnail.png",
    originalSize: 819200,
    outputSize: 307200,
    status: "pending",
    progress: 0,
  },
];

const REMOVE_BG_FILES: DemoFile[] = [
  {
    name: "portrait.jpg",
    originalSize: 2457600,
    outputSize: 1843200,
    status: "pending",
    progress: 0,
  },
  {
    name: "product.png",
    originalSize: 1638400,
    outputSize: 1228800,
    status: "pending",
    progress: 0,
  },
  {
    name: "headshot.webp",
    originalSize: 921600,
    outputSize: 716800,
    status: "pending",
    progress: 0,
  },
  {
    name: "avatar.jpg",
    originalSize: 614400,
    outputSize: 512000,
    status: "pending",
    progress: 0,
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFilesForWorkflow(workflowId: string): DemoFile[] {
  if (workflowId === "compress") return COMPRESS_FILES;
  if (workflowId === "convert") return CONVERT_FILES;
  if (workflowId === "blur-text") return COMPRESS_FILES;
  return REMOVE_BG_FILES;
}

function RemoveBgDemo({
  workflow,
  onDragStateChange,
}: {
  workflow: Workflow;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { containerRef, handleMouseDown, handleTouchStart } = useImageCompareDrag({
    initialSplit: 50,
    onDragStateChange,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-ew-resize select-none touch-none"
          style={{ "--split": "50%" } as CSSProperties}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          tabIndex={0}
          aria-label="Image comparison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%) 50% / 16px 16px",
            }}
          />
          <img
            src="/photo-1529139574466-a303027c1d8b_nobg.png"
            alt="Background removed"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
          <img
            src="/photo-1529139574466-a303027c1d8b.jpeg"
            alt="Original"
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              clipPath: "inset(0 calc(100% - var(--split)) 0 0)",
            }}
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/60"
            style={{ left: "var(--split)" }}
          />
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: "var(--split)" }}
          >
            <div className="flex h-7 w-5 items-center justify-center border border-border bg-background/80 text-foreground/90">
              <GripVertical className="size-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 border border-border bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/80">
            Before
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 border border-border bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/80">
            After
          </div>
        </div>
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {workflow.formats.map((f) => (
            <span
              key={f}
              className="border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlurTextDemo({
  workflow,
  onDragStateChange,
}: {
  workflow: Workflow;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { containerRef, handleMouseDown, handleTouchStart } = useImageCompareDrag({
    initialSplit: 45,
    onDragStateChange,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-ew-resize select-none touch-none"
          style={{ "--split": "45%" } as CSSProperties}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          tabIndex={0}
          aria-label="Blur text comparison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={45}
        >
          <img
            src="/blur-text-after.jpg"
            alt="Blurred text"
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
          <img
            src="/blur-text-before.jpg"
            alt="Original"
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              clipPath: "inset(0 calc(100% - var(--split)) 0 0)",
            }}
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/60"
            style={{ left: "var(--split)" }}
          />
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: "var(--split)" }}
          >
            <div className="flex h-7 w-5 items-center justify-center border border-border bg-background/80 text-foreground/90">
              <GripVertical className="size-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 border border-border bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/80">
            Before
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 border border-border bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/80">
            After
          </div>
        </div>
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {workflow.formats.map((f) => (
            <span
              key={f}
              className="border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowDemo({
  workflow,
  onDragStateChange,
}: {
  workflow: Workflow;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const initialFiles = useMemo(() => getFilesForWorkflow(workflow.id), [workflow.id]);
  const [files, setFiles] = useState<DemoFile[]>(initialFiles.map((f) => ({ ...f })));

  useEffect(() => {
    let cancelled = false;

    const processFile = async (index: number): Promise<void> => {
      if (cancelled) return;

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === index ? { ...f, status: "processing" as const, progress: 0 } : f,
        ),
      );

      const speed = 25 + Math.random() * 35;
      for (let p = 0; p <= 100; p += 5) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, speed));
        setFiles((prev) => prev.map((f, idx) => (idx === index ? { ...f, progress: p } : f)));
      }

      if (cancelled) return;
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === index ? { ...f, status: "done" as const, progress: 100 } : f,
        ),
      );
    };

    const runLoop = async () => {
      while (!cancelled) {
        setFiles(initialFiles.map((f) => ({ ...f })));
        await new Promise((r) => setTimeout(r, 500));

        const queue = initialFiles.map((_, i) => i);
        const active: Promise<void>[] = [];
        const PARALLEL = 2;

        const startNext = () => {
          if (queue.length === 0 || cancelled) return;
          const nextIndex = queue.shift();
          if (nextIndex === undefined) return;
          const promise = processFile(nextIndex).then(() => {
            const idx = active.indexOf(promise);
            if (idx > -1) active.splice(idx, 1);
            startNext();
          });
          active.push(promise);
        };

        for (let i = 0; i < PARALLEL && queue.length > 0; i++) {
          startNext();
        }

        while (active.length > 0 && !cancelled) {
          await Promise.race(active);
        }

        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };

    runLoop();
    return () => {
      cancelled = true;
    };
  }, [initialFiles]);

  const getOutputName = (name: string) => {
    if (workflow.id === "convert") {
      return name.replace(/\.(png|gif|webp)$/i, ".jpg");
    }
    return name;
  };

  if (workflow.id === "remove-bg") {
    return <RemoveBgDemo workflow={workflow} onDragStateChange={onDragStateChange} />;
  }
  if (workflow.id === "blur-text") {
    return <BlurTextDemo workflow={workflow} onDragStateChange={onDragStateChange} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-[70px_1fr_60px_60px_45px] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div>Status</div>
        <div>Name</div>
        <div className="text-right">Before</div>
        <div className="text-right">After</div>
        <div className="text-right">%</div>
      </div>

      <div className="flex-1 overflow-auto">
        {files.map((file) => {
          const savings = ((file.originalSize - file.outputSize) / file.originalSize) * 100;
          return (
            <div
              key={file.name}
              className="grid grid-cols-[70px_1fr_60px_60px_45px] items-center gap-2 border-b border-border px-3 py-2 text-xs"
            >
              <div>
                {file.status === "pending" && (
                  <span className="text-muted-foreground">Pending</span>
                )}
                {file.status === "processing" && (
                  <span className="text-chart-1">{Math.round(file.progress)}%</span>
                )}
                {file.status === "done" && <span className="font-medium text-green-500">Done</span>}
              </div>
              <div className="truncate text-foreground">
                {file.status === "done" ? getOutputName(file.name) : file.name}
              </div>
              <div className="text-right tabular-nums text-muted-foreground">
                {formatBytes(file.originalSize)}
              </div>
              <div className="text-right tabular-nums">
                {file.status === "done" ? formatBytes(file.outputSize) : "-"}
              </div>
              <div className="text-right tabular-nums">
                {file.status === "done" ? (
                  <span className="text-green-500">-{savings.toFixed(0)}%</span>
                ) : (
                  "-"
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {workflow.formats.map((f) => (
            <span
              key={f}
              className="border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowSelector({
  workflows,
  selected,
  onSelect,
}: {
  workflows: Workflow[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border border-border bg-muted/30 p-1">
      {workflows.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelect(w.id)}
          className={`flex-1 px-3 py-2 text-xs uppercase tracking-wider transition-all ${
            selected === w.id
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="group relative border border-border bg-card p-5 transition-all hover:border-foreground/20">
      <div
        className="absolute left-0 top-0 h-full w-0.5 transition-all group-hover:h-full"
        style={{ background: `var(--${accent})` }}
      />
      <Icon className="mb-3 size-5 text-muted-foreground" />
      <h3 className="mb-1 text-sm uppercase tracking-wider text-foreground">{title}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ComingSoonGrid() {
  return (
    <div className="grid grid-cols-4 gap-px bg-border">
      {COMING_SOON.map((feature) => (
        <div
          key={feature}
          className="group flex items-center justify-center bg-card px-2 py-4 transition-all hover:bg-muted/30"
        >
          <span className="text-center text-[10px] uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
            {feature}
          </span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const { isDark, toggle } = useTheme();
  const [selectedWorkflow, setSelectedWorkflow] = useState("remove-bg");
  const [autoCycle, setAutoCycle] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const { info, platform } = useDownloadInfo();
  const currentWorkflow = WORKFLOWS.find((w) => w.id === selectedWorkflow) ?? WORKFLOWS[0];

  useEffect(() => {
    if (!autoCycle || isDragging) return;

    const interval = setInterval(() => {
      setSelectedWorkflow((current) => {
        const idx = WORKFLOWS.findIndex((w) => w.id === current);
        const nextIdx = (idx + 1) % WORKFLOWS.length;
        return WORKFLOWS[nextIdx].id;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [autoCycle, isDragging]);

  const handleWorkflowSelect = (id: string) => {
    setAutoCycle(false);
    setSelectedWorkflow(id);
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <header className="relative z-20 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              alt="SupaIMG"
              src={logoUrl}
              className="size-6 object-contain invert dark:invert-0"
            />
            <span className="text-sm uppercase tracking-wider text-foreground">SupaIMG</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#workflows"
              className="text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Workflows
            </a>
            <a
              href="#features"
              className="text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <button
              type="button"
              onClick={toggle}
              className="ml-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 border border-chart-1/40 bg-chart-1/10 px-3 py-1.5 text-[10px] uppercase tracking-wider text-chart-1">
                  <span className="size-1.5 rounded-full bg-chart-1" />
                  Local First • Privacy by Default
                </div>

                <h1 className="mb-6 text-4xl font-bold uppercase leading-[1.1] tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl">
                  <span className="block">A Local</span>
                  <span className="block text-chart-1">Swiss Army Knife</span>
                  <span className="block text-muted-foreground/60">For Your Images</span>
                </h1>

                <p className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
                  Compress, convert, and remove backgrounds with best-in-class codecs.
                  Cross-platform desktop app that never uploads your files.
                </p>

                <DownloadButtons info={info} platform={platform} />
              </div>

              <div className="relative">
                <div className="mb-4">
                  <WorkflowSelector
                    workflows={WORKFLOWS}
                    selected={selectedWorkflow}
                    onSelect={handleWorkflowSelect}
                  />
                </div>
                <div className="relative h-[320px] overflow-hidden border border-border bg-card">
                  <WorkflowDemo
                    key={currentWorkflow.id}
                    workflow={currentWorkflow}
                    onDragStateChange={setIsDragging}
                  />
                </div>
                <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                  {currentWorkflow.tagline}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="workflows" className="border-y border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  01
                </span>
                <h2 className="mt-1 text-2xl font-bold uppercase tracking-tight text-foreground text-balance">
                  Four Workflows
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">More coming soon</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOWS.map((workflow, i) => (
                <div
                  key={workflow.id}
                  className="group relative border border-border bg-card p-6 transition-all hover:border-foreground/20"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ background: `var(--${workflow.color})` }}
                  />
                  <span className="text-[10px] text-muted-foreground">0{i + 1}</span>
                  <h3 className="mb-2 mt-3 text-lg font-bold uppercase tracking-wider text-foreground">
                    {workflow.name}
                  </h3>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    {workflow.tagline}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {workflow.formats.map((f) => (
                      <span
                        key={f}
                        className="border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">02</span>
              <h2 className="mt-1 text-2xl font-bold uppercase tracking-tight text-foreground text-balance">
                Built Different
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={Lock}
                title="Privacy First"
                description="Everything runs locally. No uploads, no tracking, no telemetry."
                accent="chart-1"
              />
              <FeatureCard
                icon={Paintbrush}
                title="Batch Processing"
                description="Drop entire folders. Process hundreds of files at once."
                accent="chart-2"
              />
              <FeatureCard
                icon={CheckCircle2}
                title="Instant Compare"
                description="Side-by-side comparison before you save."
                accent="chart-3"
              />
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">03</span>
              <h2 className="mt-1 text-2xl font-bold uppercase tracking-tight text-foreground text-balance">
                Coming Soon
              </h2>
            </div>

            <div className="overflow-hidden border border-border">
              <ComingSoonGrid />
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              More workflows shipping throughout the year.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="mb-4 text-3xl font-bold uppercase tracking-tight text-foreground text-balance">
              Ready to Start?
            </h2>
            <p className="mb-8 text-sm text-muted-foreground text-pretty">
              Download SupaIMG and process your first images in seconds.
            </p>
            <DownloadButtons info={info} platform={platform} centered />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                alt="SupaIMG"
                src={logoUrl}
                className="size-4 object-contain invert dark:invert-0"
              />
              <span className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} SupaIMG
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>macOS • Windows • Linux</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
