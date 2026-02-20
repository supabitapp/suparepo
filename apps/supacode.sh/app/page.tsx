import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { BrewInstallCommand, DownloadButton, TrackedLink } from "./components";

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
  {
    title: "Open source",
    description: "Fully open source. Read, fork, and contribute on GitHub.",
  },
];

export default function Home() {
  return (
    <main>
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-8 px-8 py-10">
        <section className="grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <div
                className="supacode-reveal flex items-center gap-4"
                style={{ animationDelay: "40ms" }}
              >
                <img src="/supacode-app-icon.png" alt="Supacode app icon" className="size-16" />
                <span className="text-sm uppercase tracking-[0.35em] text-foreground">
                  supacode
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
                Native terminal coding agents command center.
              </h1>
              <p
                className="supacode-reveal max-w-2xl text-base text-muted-foreground md:text-lg"
                style={{ animationDelay: "200ms" }}
              >
                Run 50+ coding agents in parallel. Blazing fast, open source, native macOS app.
              </p>
            </div>
            <div
              className="supacode-reveal flex flex-col gap-1.5"
              style={{ animationDelay: "280ms" }}
            >
              <DownloadButton />
              <span className="text-sm text-muted-foreground">or</span>
              <BrewInstallCommand />
              <span className="text-xs text-muted-foreground">Requires macOS 26 Tahoe</span>
            </div>
          </div>
          <div
            className="supacode-reveal flex flex-col lg:-mr-8"
            style={{ animationDelay: "340ms" }}
          >
            <img
              src="/screenshot.png"
              alt="Supacode running multiple coding agents in parallel"
              className="max-h-[85vh] w-full rounded-xl object-contain object-right shadow-2xl"
            />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Actual screenshot of using supacode to develop supacode
            </p>
          </div>
        </section>

        <Separator className="supacode-reveal" style={{ animationDelay: "400ms" }} />

        <section className="grid shrink-0 gap-4 md:grid-cols-5">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="supacode-reveal border-border/70"
              style={{ animationDelay: `${460 + index * 60}ms` }}
            >
              <CardHeader className="space-y-1.5 p-5">
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

        <footer
          className="supacode-reveal mt-auto shrink-0 text-right text-sm text-muted-foreground"
          style={{ animationDelay: "940ms" }}
        >
          <TrackedLink
            href="https://github.com/supabitapp/supacode"
            event="github_star_clicked"
            className="underline hover:text-foreground"
          >
            Star us on GitHub
          </TrackedLink>
          <span className="mx-2">·</span>
          <TrackedLink
            href="https://github.com/supabitapp/supacode/releases"
            event="release_notes_clicked"
            className="underline hover:text-foreground"
          >
            Release Notes
          </TrackedLink>
          <span className="mx-2">·</span>
          <TrackedLink
            href="https://docs.supacode.sh"
            event="docs_clicked"
            className="underline hover:text-foreground"
          >
            Docs
          </TrackedLink>
          <span className="mx-2">·</span>
          Made with ❤️ by{" "}
          <TrackedLink
            href="https://x.com/khoiracle"
            event="twitter_clicked"
            className="underline hover:text-foreground"
          >
            @khoiracle
          </TrackedLink>
        </footer>
      </div>
    </main>
  );
}
