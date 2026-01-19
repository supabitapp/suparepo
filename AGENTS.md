# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                    # install dependencies
bun run dev                    # run all apps (turbo)
bun run build                  # build all apps
bun run lint:fix               # oxlint --fix
bun run fmt:check              # oxfmt check
bun run check-types            # typecheck all packages

# Single app dev
bun run supabit.app:dev        # Next.js on :3001
bun run desktop:dev            # Tauri dev mode
bun run desktop:build          # Tauri production build
```

## Architecture

Turborepo monorepo with bun workspaces:

- `apps/desktop` - Tauri v2 desktop (React 19 + Vite frontend, Rust backend)
- `apps/supabit.app` - Next.js 16 marketing site
- `packages/ui` - Shared components (Base UI, Shadcn patterns, Tailwind v4)
- `packages/typescript-config` - Shared tsconfig

UI package exports: `@repo/ui/components/ui/button`, `@repo/ui/lib/utils`

## References

- Tauri docs https://tauri.app/llms.txt
- Shadcn https://ui.shadcn.com/llms.txt
- Turborepo https://turborepo.dev/llms.txt

## PR Descriptions

When creating or updating PRs, do not add a templated Summary/Testing block unless explicitly requested. Keep the PR description to a single concise sentence or use text provided by khoi.
