import { AppleFinderIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";

const features = [
  {
    title: "Fully native app",
    description: "Native macOS app with libghostty as the engine.",
  },
  {
    title: "BYOA — Bring your own agents",
    description: "Run Claude Code, Codex, Opencode in terminal without any translation layer.",
  },
  {
    title: "Worktree integration",
    description: "Isolated git worktree per task. Give each agent a free space to do its thing.",
  },
  {
    title: "GitHub integration",
    description: "Open PRs, see CI checks, fix conflicts, and more.",
  },
];

export default function Home() {
  return (
    <main className="h-screen overflow-hidden">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-6 px-6 py-8">
        <section className="grid flex-1 items-center gap-6 lg:grid-cols-[380px_1fr] lg:gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div
                className="supacode-reveal flex items-center gap-4"
                style={{ animationDelay: "40ms" }}
              >
                <img src="/supacode-app-icon.png" alt="Supacode app icon" className="size-12" />
                <span className="text-xs uppercase tracking-[0.35em] text-foreground">
                  supacode
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Run 50+ coding agents in parallel.
              </h1>
              <p
                className="supacode-reveal max-w-2xl text-sm text-muted-foreground md:text-base"
                style={{ animationDelay: "200ms" }}
              >
                Blazing fast native macOS app
              </p>
            </div>
            <div
              className="supacode-reveal flex flex-wrap items-center gap-3"
              style={{ animationDelay: "280ms" }}
            >
              <a href="https://supacode.sh/download/latest/supacode.dmg">
                <Button size="lg" className="gap-2 text-xs uppercase tracking-[0.2em]">
                  <HugeiconsIcon icon={AppleFinderIcon} className="size-4" strokeWidth={2} />
                  Download for macOS
                </Button>
              </a>
            </div>
          </div>
          <div
            className="supacode-reveal flex flex-col lg:-mr-6"
            style={{ animationDelay: "340ms" }}
          >
            <img
              src="/screenshot.png"
              alt="Supacode running multiple coding agents in parallel"
              className="max-h-[60vh] w-full rounded-lg border border-border/50 object-contain object-right shadow-2xl"
            />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Actual screenshot of using supacode to develop supacode
            </p>
          </div>
        </section>

        <Separator className="supacode-reveal" style={{ animationDelay: "400ms" }} />

        <section className="grid shrink-0 gap-3 md:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="supacode-reveal border-border/70"
              style={{ animationDelay: `${460 + index * 60}ms` }}
            >
              <CardHeader className="space-y-1 p-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.25em]">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <footer
          className="supacode-reveal shrink-0 text-right text-sm text-muted-foreground"
          style={{ animationDelay: "700ms" }}
        >
          Made with ❤️ by{" "}
          <a href="https://x.com/khoiracle" className="underline hover:text-foreground">
            @khoiracle
          </a>
        </footer>
      </div>
    </main>
  );
}
