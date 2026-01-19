import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  AppleIcon,
  ArrowShrinkIcon,
  BlurIcon,
  DragDropVerticalIcon,
  Image01Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MainToolbar } from "@/components/main-toolbar";
import { getWorkflow, type Workflow } from "@/lib/workflows";

const FEATURES: {
  id: string;
  title: string;
  description: string;
  icon: typeof ArrowShrinkIcon;
  action?: Workflow;
  comingSoon?: boolean;
}[] = [
  {
    id: "compress",
    title: "Compress IMAGE",
    description: "Compress images (lossless).",
    icon: ArrowShrinkIcon,
    action: "compress",
  },
  {
    id: "convert",
    title: "Convert Images",
    description: "Convert between JPG, PNG, GIF, and WEBP formats in bulk.",
    icon: Image01Icon,
    action: "convert",
  },
  {
    id: "remove-background",
    title: "Remove background",
    description:
      "Quickly remove image backgrounds with high accuracy. Instantly detect objects and cut out backgrounds with ease.",
    icon: DragDropVerticalIcon,
    action: "remove_bg",
  },
  {
    id: "blur-text",
    title: "Blur Text",
    description:
      "Automatically detect and blur sensitive text in your images with adjustable strength.",
    icon: BlurIcon,
    action: "blur_text",
  },
  {
    id: "resize",
    title: "Resize IMAGE",
    description:
      "Define your dimensions, by percent or pixel, and resize your JPG, PNG, SVG, and GIF images.",
    icon: Sun03Icon,
    comingSoon: true,
  },
  {
    id: "crop",
    title: "Crop IMAGE",
    description:
      "Crop JPG, PNG, or GIFs with ease; choose pixels to define your rectangle or use our visual editor.",
    icon: Moon02Icon,
    comingSoon: true,
  },
  {
    id: "convert-from-jpg",
    title: "Convert from JPG",
    description:
      "Turn JPG images to PNG and GIF. Choose several JPGs to create an animated GIF in seconds!",
    icon: Sun03Icon,
    comingSoon: true,
  },
  {
    id: "upscale",
    title: "Upscale Image",
    description:
      "Enlarge your images with high resolution. Easily increase the size of your JPG and PNG images while maintaining visual quality.",
    icon: Sun03Icon,
    comingSoon: true,
  },
  {
    id: "watermark",
    title: "Watermark IMAGE",
    description:
      "Stamp an image or text over your images in seconds. Choose the typography, transparency and position.",
    icon: AppleIcon,
    comingSoon: true,
  },
];

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const openAction = (action: Workflow) => navigate({ to: getWorkflow(action).route });
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-auto scrollbar-none">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {FEATURES.map((feature) => {
              const content = (
                <CardContent className="relative flex flex-col gap-3">
                  {feature.comingSoon ? (
                    <span className="absolute right-2 top-2 border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Coming soon
                    </span>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center border border-border bg-muted/40 text-muted-foreground transition duration-200 group-hover/card:border-foreground/20 group-hover/card:text-foreground">
                      <HugeiconsIcon icon={feature.icon} className="size-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              );

              if (feature.action) {
                const action = feature.action;
                return (
                  <Card key={feature.id}>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => openAction(action)}
                      aria-label={`Open ${feature.title}`}
                    >
                      {content}
                    </button>
                  </Card>
                );
              }

              return (
                <Card key={feature.id} className="opacity-50" aria-disabled="true">
                  {content}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      <MainToolbar />
    </div>
  );
}
