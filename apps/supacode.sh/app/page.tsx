import { AppleFinderIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";

const features = [
  {
    title: "Fully native app",
    description: "A real native Swift app, not a web wrapper.",
  },
  {
    title: "BYOA — Bring your own agents",
    description: "Run Claude Code, Codex, or any agent directly, with zero translation layer.",
  },
  {
    title: "Powered by Ghostty",
    description: "libghostty terminal performance at the core.",
  },
  {
    title: "Worktree integration",
    description: "Isolated git worktrees per task, ready for review or handoff.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-10 px-6 py-16 md:py-24">
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div
              className="supacode-reveal flex items-center gap-4"
              style={{ animationDelay: "40ms" }}
            >
              <img src="/supacode-app-icon.png" alt="Supacode app icon" className="size-12" />
              <span className="text-xs uppercase tracking-[0.35em] text-foreground">supacode</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
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
        </section>

        <Separator className="supacode-reveal" style={{ animationDelay: "340ms" }} />

        <section className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="supacode-reveal border-border/70"
              style={{ animationDelay: `${400 + index * 60}ms` }}
            >
              <CardHeader className="space-y-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.25em]">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
