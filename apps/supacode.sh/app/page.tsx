import { Separator } from "@repo/ui/components/ui/separator";
import { BrewInstallCommand, DownloadButton, TrackedLink } from "./components";

const features = [
  {
    title: "Fully native",
    description:
      "Built on libghostty. No Electron, no web wrappers. Pure macOS performance you can feel in every keystroke.",
    badge: "macOS",
  },
  {
    title: "Bring your own agents",
    description:
      "Run Claude Code, Codex, Opencode — any CLI agent, no translation layer. Your terminal, your rules.",
    badge: "BYOA",
  },
  {
    title: "Worktree isolation",
    description:
      "Every agent gets its own git worktree. No conflicts, no stepping on toes. True parallel development.",
    badge: "Git",
  },
  {
    title: "GitHub native",
    description:
      "Open PRs, review CI checks, resolve conflicts — all without leaving the terminal.",
    badge: "GitHub",
  },
  {
    title: "Open source",
    description: "Read every line. Fork it. Break it. Fix it. Ship it. Fully open on GitHub.",
    badge: "OSS",
  },
  {
    title: "50+ agents",
    description:
      "Run dozens of coding agents simultaneously. Each in its own isolated environment, all under one roof.",
    badge: "Scale",
  },
];

export default function Home() {
  return (
    <main>
      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-10 md:px-8">
        <nav
          className="supacode-reveal mb-20 flex items-center justify-between md:mb-28"
          style={{ animationDelay: "40ms" }}
        >
          <div className="flex items-center gap-3">
            <img src="/supacode-app-icon.png" alt="Supacode" className="size-9" />
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-foreground">
              supacode
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <TrackedLink
              href="https://docs.supacode.sh"
              event="nav_docs_clicked"
              className="transition-colors hover:text-foreground"
            >
              Docs
            </TrackedLink>
            <TrackedLink
              href="https://github.com/supabitapp/supacode"
              event="nav_github_clicked"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </TrackedLink>
          </div>
        </nav>

        <section className="mb-16 flex flex-col items-center text-center md:mb-24">
          <h1
            className="supacode-reveal max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            The command center for coding agents.
          </h1>
          <p
            className="supacode-reveal mt-6 max-w-xl text-base text-muted-foreground md:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            Run 50+ coding agents in parallel. Blazing fast, open source, native macOS app built on
            libghostty.
          </p>
          <div
            className="supacode-reveal mt-10 flex flex-col items-center gap-2"
            style={{ animationDelay: "280ms" }}
          >
            <DownloadButton />
            <span className="text-sm text-muted-foreground">or</span>
            <BrewInstallCommand />
            <span className="mt-1 text-xs text-muted-foreground">Requires macOS 26 Tahoe</span>
          </div>
        </section>

        <section className="supacode-reveal mb-24 md:mb-32" style={{ animationDelay: "360ms" }}>
          <div className="hero-glow relative overflow-hidden rounded-xl border border-border/50">
            <img
              src="/screenshot.png"
              alt="Supacode running multiple coding agents in parallel"
              className="w-full"
            />
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Actual screenshot of using supacode to develop supacode
          </p>
        </section>

        <Separator className="supacode-reveal mb-24 md:mb-32" style={{ animationDelay: "420ms" }} />

        <section className="mb-24 md:mb-32">
          <h2
            className="supacode-reveal mb-12 text-center text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground md:mb-16"
            style={{ animationDelay: "480ms" }}
          >
            Built different
          </h2>
          <div className="grid gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="supacode-reveal flex flex-col gap-3 bg-background p-8"
                style={{ animationDelay: `${540 + index * 60}ms` }}
              >
                <span className="w-fit rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {feature.badge}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="supacode-reveal mb-24 flex flex-col items-center gap-6 text-center md:mb-32">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Ready to run your agents?
          </h2>
          <DownloadButton />
        </section>

        <Separator className="supacode-reveal" />

        <footer className="supacode-reveal flex flex-col items-center gap-4 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/supacode-app-icon.png" alt="Supacode" className="size-5" />
            <span className="font-medium text-foreground">Supacode</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <TrackedLink
              href="https://github.com/supabitapp/supacode"
              event="footer_github_clicked"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </TrackedLink>
            <TrackedLink
              href="https://github.com/supabitapp/supacode/releases"
              event="footer_releases_clicked"
              className="transition-colors hover:text-foreground"
            >
              Releases
            </TrackedLink>
            <TrackedLink
              href="https://docs.supacode.sh"
              event="footer_docs_clicked"
              className="transition-colors hover:text-foreground"
            >
              Docs
            </TrackedLink>
            <TrackedLink
              href="https://x.com/khoiracle"
              event="footer_twitter_clicked"
              className="transition-colors hover:text-foreground"
            >
              @khoiracle
            </TrackedLink>
          </div>
        </footer>
      </div>
    </main>
  );
}
