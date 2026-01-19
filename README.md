# Suparepo

A monorepo for Supaimg and Supabit apps.

- Marketing websites
- Tauri desktop app

## Stack

- Turborepo
- Bun
- Tauri
- React with TailwindCSS/Shadcn UI
- NextJS
- Oxc for linting and formatting

## Workflows

Canonical workflow data lives in `apps/supaimg-desktop/workflows.json`.

Generate derived files:

```
bun run workflows:gen
```

Check if generated files are up to date:

```
bun run workflows:check
```
