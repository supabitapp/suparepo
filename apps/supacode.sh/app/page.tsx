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
    title: "Source available",
    description: "Read the code, report issues, and contribute on GitHub.",
    badge: "Source",
  },
  {
    title: "50+ agents",
    description:
      "Run dozens of coding agents simultaneously. Each in its own isolated environment, all under one roof.",
    badge: "Scale",
  },
];

const licenseQuestions = [
  {
    question: "What counts toward the free trial?",
    answer:
      "Your first five successful local worktree creations across all repositories on this Mac. Deleting a worktree does not reset the count. Failed creations do not count, and SSH worktree creation stays free.",
  },
  {
    question: "What happens after five creations?",
    answer:
      "Supacode asks for a license before creating another local worktree. Your existing worktrees and terminals remain usable. If you already use Supacode, you get five additional local creations when you first install the licensed version.",
  },
  {
    question: "How do I activate or move my license?",
    answer:
      "For Basic and Standard, we email your license key after checkout. Paste it into Settings → License. Basic allows one active Mac and Standard allows two, both for one person. Team buyers use the license portal to assign seats and email each person their own key for one Mac. Deactivate a Mac in Settings → License to free its place; Team owners can also reassign seats in the portal.",
  },
  {
    question: "Do I have to renew?",
    answer:
      "No. Keep using the versions you own forever. Your purchase includes one year of updates. Basic and Standard can renew for $59 USD per license for another year, with no automatic renewal. Contact support for Team update renewals. Basic and Standard owners can download included versions from the license portal.",
  },
  {
    question: "Can I work offline?",
    answer:
      "Activation needs an internet connection. Basic and Standard can use their saved licenses offline. Team seats need an online refresh at least every seven days so owners can revoke or reassign access. License changes take effect when the app next connects.",
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
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <TrackedLink
              href="#pricing"
              event="nav_pricing_clicked"
              className="transition-colors hover:text-foreground"
            >
              Pricing
            </TrackedLink>
            <TrackedLink
              href="https://license.supacode.sh/login"
              event="nav_license_clicked"
              className="transition-colors hover:text-foreground"
            >
              My license
            </TrackedLink>
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
            Run 50+ coding agents in parallel. Blazing fast, source available, native macOS app
            built on libghostty.
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

        <section id="pricing" className="mb-24 scroll-mt-10 md:mb-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Buy once. Use forever.
            </h2>
            <p className="mt-4 text-muted-foreground">
              A lifetime license with one year of updates. No subscription, no automatic renewal.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                id: "basic",
                name: "Basic",
                price: 99,
                devices: "One Mac",
                audience: "One person",
                summary: "One-time payment. No subscription.",
              },
              {
                id: "standard",
                name: "Standard",
                price: 129,
                devices: "Two Macs",
                audience: "One person",
                summary: "Compared with two Basic licenses.",
              },
              {
                id: "team",
                name: "Team",
                price: 79,
                devices: "One Mac / seat",
                audience: "Starts at 3 seats",
                summary: "One-time payment. No subscription.",
              },
            ].map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border bg-background p-7 md:p-9 ${plan.id === "standard" ? "border-primary" : "border-border"}`}
              >
                {plan.id === "standard" && (
                  <span className="absolute -top-4 right-6 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                    Save 35%
                  </span>
                )}
                {plan.id === "team" && (
                  <span className="absolute -top-4 right-6 rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background">
                    For teams
                  </span>
                )}
                <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-6 flex flex-wrap items-baseline gap-3">
                  {plan.id === "standard" && <s className="text-2xl text-muted-foreground">$198</s>}
                  <span className="text-5xl font-semibold tracking-tight">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">
                    USD / {plan.id === "team" ? "seat" : "license"}
                  </span>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{plan.summary}</p>
                <ul className="my-8 space-y-4 border-t border-border pt-7 text-sm leading-relaxed">
                  <li className="font-semibold">{plan.devices}</li>
                  <li>{plan.audience}</li>
                  <li>Unlimited local worktree creations</li>
                  <li>Buy once, keep the versions you own</li>
                  <li>365 days of updates included</li>
                  {plan.id === "team" ? (
                    <>
                      <li>Team portal for seat assignment and reassignment</li>
                      <li>Each seat gets its own license key</li>
                    </>
                  ) : (
                    <>
                      <li>Move between Macs by deactivating a previous Mac</li>
                      <li>Optional $59 renewal for the whole license</li>
                    </>
                  )}
                </ul>
                <TrackedLink
                  href={`https://license.supacode.sh/buy?plan=${plan.id}`}
                  event={`purchase_${plan.id}_clicked`}
                  className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${plan.id === "standard" ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
                >
                  Buy {plan.name}
                </TrackedLink>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-7 max-w-3xl text-center text-sm text-muted-foreground">
            <TrackedLink
              href="https://license.supacode.sh/login"
              event="pricing_license_clicked"
              className="inline-block underline underline-offset-4"
            >
              Manage an existing license
            </TrackedLink>
          </div>
          <div className="mx-auto mt-12 max-w-2xl">
            <h3 className="mb-6 text-xl font-semibold tracking-tight">Licensing questions</h3>
            {licenseQuestions.map(({ question, answer }) => (
              <details key={question} className="border-b border-border py-5">
                <summary className="cursor-pointer font-medium">{question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{answer}</p>
              </details>
            ))}
            <p className="mt-6 text-sm text-muted-foreground">
              Need help?{" "}
              <a className="underline underline-offset-4" href="mailto:license@supacode.sh">
                license@supacode.sh
              </a>
            </p>
          </div>
        </section>

        <Separator className="supacode-reveal" />

        <footer className="supacode-reveal flex flex-col items-center gap-4 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/supacode-app-icon.png" alt="Supacode" className="size-5" />
            <span className="font-medium text-foreground">Supacode</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="https://license.supacode.sh/terms" className="hover:text-foreground">
              Terms
            </a>
            <a href="https://license.supacode.sh/refunds" className="hover:text-foreground">
              Refunds
            </a>
            <a href="https://license.supacode.sh/privacy" className="hover:text-foreground">
              Privacy
            </a>
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
