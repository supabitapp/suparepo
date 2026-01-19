# Move SupaIMG Desktop Into Suparepo

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

There is no PLANS.md in this repository at the time of writing. If one is added later, this plan must be updated to follow it.

## Purpose / Big Picture

Bring the full SupaIMG desktop application into this repository while keeping the existing apps/desktop intact. After this change, there will be a new app at apps/supaimg-desktop that runs the same Tauri-based image workflows (compress, convert, remove background, blur text) with SupaIMG branding, updater configuration, and model setup. You should be able to run the SupaIMG desktop app from this repo with the same behavior as the source repo, while the existing apps/desktop remains unchanged.

## Progress

- [x] (2026-01-19 00:00Z) Audited source (supaimg) and target (suparepo) desktop apps, UI packages, Tauri configs, and model assets to understand scope and dependencies.
- [x] (2026-01-19 18:05Z) Copied SupaIMG desktop app into apps/supaimg-desktop without build artifacts.
- [x] (2026-01-19 18:20Z) Updated the new app’s package config, Vite aliases, CSS entrypoint, and all UI imports to use @repo/ui, including test mocks.
- [x] (2026-01-19 18:30Z) Merged SupaIMG UI components and utilities into packages/ui with repo style precedence, added missing dependencies, and restored the scrollbar-none utility.
- [x] (2026-01-19 18:35Z) Added .gitattributes LFS rules, .gitignore entries, root scripts, and lint-staged coverage for the new app, then refreshed bun.lock.
- [x] (2026-01-19 18:55Z) Ran frontend and Rust test suites for apps/supaimg-desktop successfully.

## Surprises & Discoveries

- The source SupaIMG desktop app includes large local model assets under apps/desktop/src-tauri/models (~1.3GB) and uses Git LFS for onnxruntime binaries while ignoring apps/desktop/src-tauri/models/onnx/\*\* in .gitignore.
- SupaIMG UI components rely on @hugeicons packages and sonner, which are not currently in the target packages/ui dependencies.
- SupaIMG frontend uses TanStack Router with a generated routeTree.gen.ts and a single @ alias for src imports.
- The settings migration tests expected blur_mode default "gaussian" while the workflow schema default was "pixelate", so the schema default was adjusted to match the tests.

## Decision Log

- Decision: Keep both desktop apps by adding the SupaIMG app as apps/supaimg-desktop and leaving apps/desktop unchanged.
  Rationale: Avoids breaking or renaming the existing app while enabling SupaIMG to live side-by-side.
  Date: 2026-01-19 00:00Z
- Decision: Merge SupaIMG packages/ui into the existing packages/ui, with the repository’s style and existing implementations taking precedence on conflicts.
  Rationale: Preserves a single UI source of truth and the repo’s established patterns.
  Date: 2026-01-19 00:00Z
- Decision: Keep SupaIMG identity (productName, identifier, updater config, telemetry integration).
  Rationale: The SupaIMG desktop app should remain branded and configured as SupaIMG.
  Date: 2026-01-19 00:00Z
- Decision: Keep the SupaIMG model setup, including LFS tracking for onnxruntime binaries and ignoring onnx model blobs.
  Rationale: Matches the existing SupaIMG workflow and avoids new migration behavior.
  Date: 2026-01-19 00:00Z
- Decision: Set the blur text default mode to "gaussian" to match the settings migration tests.
  Rationale: Keeps defaults consistent with the test suite’s expected behavior and prevents regressions during settings sanitization.
  Date: 2026-01-19 18:45Z

## Outcomes & Retrospective

The SupaIMG desktop app now lives in apps/supaimg-desktop with SupaIMG identity intact, UI imports updated to @repo/ui, and shared UI components merged into packages/ui. Frontend and Rust test suites for the new app pass, and repo tooling recognizes the new app alongside the existing desktop stub.

## Context and Orientation

Source repo (read-only reference for this plan): /Users/khoi/Developer/code/github.com/khoi/supaimg

Target repo (this repo): /Users/khoi/Developer/code/github.com/khoi/suparepo

Key source paths:

- SupaIMG desktop app: /Users/khoi/Developer/code/github.com/khoi/supaimg/apps/desktop
- SupaIMG UI package: /Users/khoi/Developer/code/github.com/khoi/supaimg/packages/ui
- SupaIMG Tauri backend: /Users/khoi/Developer/code/github.com/khoi/supaimg/apps/desktop/src-tauri
- SupaIMG frontend: /Users/khoi/Developer/code/github.com/khoi/supaimg/apps/desktop/src

Key target paths:

- Existing desktop app stub: apps/desktop
- Shared UI package: packages/ui
- Plans directory: plans

Important modules and how they connect:

- The SupaIMG frontend calls Tauri commands defined in apps/supaimg-desktop/src-tauri/src/lib.rs via apps/supaimg-desktop/src/lib/tauri.ts. The command names and event names are part of the app’s runtime contract, so they must stay aligned.
- The workflow definitions are sourced from apps/supaimg-desktop/workflows.json and compiled into the frontend model in apps/supaimg-desktop/src/lib/workflows.ts. This is the single source of truth for workflow metadata.
- The shared UI package exports components used throughout the SupaIMG frontend, so imports must be updated from @compress/ui to @repo/ui with no compatibility layer.

## Plan of Work

Create a new app folder apps/supaimg-desktop by copying the SupaIMG desktop app from the source repo, excluding build outputs and node_modules. Keep the existing apps/desktop folder intact.

Update the new app’s frontend to use @repo/ui imports and the repo’s CSS entrypoint, and ensure Vite aliasing works for both @ (src alias) and @repo/ui. Remove any use of @compress/ui to avoid maintaining backwards compatibility. Update tests to mock the new @repo/ui imports.

Merge SupaIMG’s UI components, utilities, and assets into packages/ui. For files that already exist in packages/ui, keep the existing implementations and only add missing exports or features that SupaIMG needs to compile and run. Add missing dependencies such as @hugeicons packages and sonner to packages/ui/package.json. Preserve the repository’s styling defaults; only bring over SupaIMG’s extra utilities where they do not conflict.

Bring over the SupaIMG Tauri backend and configuration into apps/supaimg-desktop/src-tauri, keeping SupaIMG’s identity and updater configuration. Add Git LFS patterns and .gitignore entries for the new app’s model paths to mirror the SupaIMG setup. Keep the large model folder present in the working tree for local runs but respect the same ignore/LFS rules when committing.

Align root tooling to recognize the new app: add scripts to run SupaIMG desktop, extend lint-staged entries for the new Tauri Rust path, and run bun install to refresh the lockfile.

## Concrete Steps

All commands should be run from the repository root: /Users/khoi/Developer/code/github.com/khoi/suparepo

1. Create the new app directory by copying the SupaIMG desktop app while excluding build outputs:

   rsync -a \
    --exclude node_modules \
    --exclude dist \
    --exclude target \
    --exclude .DS_Store \
    /Users/khoi/Developer/code/github.com/khoi/supaimg/apps/desktop/ \
    apps/supaimg-desktop/

2. Update apps/supaimg-desktop/package.json to:
   - Rename the package to a non-conflicting name such as "supaimg-desktop".
   - Replace @compress/ui with @repo/ui.
   - Keep SupaIMG’s dependencies (TanStack Router, Zustand, PostHog, motion, p-queue, hugeicons, etc.) and remove any unused entries (such as @tauri-apps/plugin-cli if not referenced).

3. Update apps/supaimg-desktop/vite.config.ts to include:
   - The TanStack Router Vite plugin.
   - An alias for @ pointing to ./src.
   - An alias for @repo/ui pointing to packages/ui/src, and server.fs.allow entries for the repo root and packages.

4. Update apps/supaimg-desktop/src/index.css to use the repo UI CSS entrypoint and to scan the app for Tailwind usage:

   @import "@repo/ui/index.css";
   @source "./\*_/_.tsx";

5. Replace all @compress/ui imports in apps/supaimg-desktop/src with @repo/ui equivalents. Use a single search/replace pass, then fix any path-specific imports manually:
   - Replace "@compress/ui/components/ui/..." with "@repo/ui/components/ui/..."
   - Replace "@compress/ui/lib/..." with "@repo/ui/lib/..."
   - Replace "@compress/ui" root imports by importing the specific component path instead, so @repo/ui does not need a root export.

6. Update apps/supaimg-desktop/src/test/setup.ts to mock the new @repo/ui paths and remove the @compress/ui root mock if it is no longer used by any app code.

7. Merge SupaIMG UI into packages/ui:
   - Copy any missing files from /Users/khoi/Developer/code/github.com/khoi/supaimg/packages/ui/src into packages/ui/src.
   - Keep existing packages/ui files when a filename already exists. If SupaIMG requires a prop or export that the repo version does not provide, extend the repo implementation to include it without changing the existing public behavior.
   - Add the missing UI components from SupaIMG: context-menu, table, progress, slider, sonner, checkbox, collapsible, dropdown-menu, select, badge if not already present.
   - Add SupaIMG utilities to packages/ui/src/lib (toast.ts, use-image-compare.ts) if missing.
   - Merge CSS by keeping packages/ui/src/index.css as the primary stylesheet and bringing over SupaIMG’s extra utility class (scrollbar-none) if it does not conflict.

8. Update packages/ui/package.json dependencies to include:
   - @hugeicons/core-free-icons
   - @hugeicons/react
   - sonner
     Keep the repo’s existing versions for shared libraries when possible, unless SupaIMG requires a newer minimum for compilation.

9. Copy SupaIMG Tauri backend and config into apps/supaimg-desktop/src-tauri, keeping SupaIMG identity:
   - Ensure apps/supaimg-desktop/src-tauri/Cargo.toml matches the SupaIMG version (name = "supaimg", lib name = "compress_lib", plugin list, and platform-specific dependencies).
   - Ensure apps/supaimg-desktop/src-tauri/tauri.conf.json retains SupaIMG’s productName, version, identifier, updater endpoints, window sizing, and security settings.
   - Copy src-tauri/capabilities, gen, icons, models, and all Rust source files.

10. Mirror Git LFS and ignore rules:

- Add a .gitattributes file in suparepo root if missing, or extend it with the LFS patterns from supaimg/.gitattributes, replacing the path prefix with apps/supaimg-desktop.
- Update .gitignore to ignore apps/supaimg-desktop/src-tauri/models/onnx/\*\* and apps/supaimg-desktop/src-tauri/target.
- Keep the working tree copy of models from the source repo for local builds, but respect the same ignore/LFS behavior on commit.

11. Add root scripts and lint-staged coverage for the new app:

- Add scripts like supaimg.desktop:dev and supaimg.desktop:build that cd into apps/supaimg-desktop and run the tauri commands.
- Extend lint-staged to include apps/supaimg-desktop/src-tauri/\*_/_.rs for cargo fmt/clippy checks.

12. Run bun install at the repo root to update bun.lock.

## Validation and Acceptance

The change is accepted when all of the following are true:

1. The SupaIMG desktop app runs from this repo with the same behavior as the source app:
   - From repo root, run:
     bun run supaimg.desktop:dev
   - The Tauri window opens and routes /compress, /convert, /remove-background, and /blur-text render with no runtime errors.
   - Drag-and-drop and the workflow processing commands operate without errors in the log.

2. Frontend unit tests for SupaIMG desktop pass:
   - From apps/supaimg-desktop:
     bun run test
   - Expect all vitest tests to pass.

3. Rust backend tests pass:
   - From repo root:
     cargo test --manifest-path apps/supaimg-desktop/src-tauri/Cargo.toml
   - Expect all Rust tests to pass.

4. Lint and type checks complete:
   - From repo root:
     bun run lint
     bun run check-types
   - Expect no errors.

## Idempotence and Recovery

All steps are safe to re-run. If the copy steps produce a broken or partial app, delete apps/supaimg-desktop and repeat the rsync step. If dependency or config changes break the build, revert the edited manifest files (package.json, Cargo.toml, tauri.conf.json) and re-apply the edits in the order described above. The existing apps/desktop app should never be touched, so any problems should be isolated to apps/supaimg-desktop and packages/ui.

## Artifacts and Notes

Expected verification snippets:

    $ bun run supaimg.desktop:dev
    ...
    tauri: Running dev server on http://localhost:1420

    $ bun run test
    ...
    Test Files  6 passed

    $ cargo test --manifest-path apps/supaimg-desktop/src-tauri/Cargo.toml
    ...
    test result: ok. N passed; 0 failed

## Interfaces and Dependencies

The frontend-to-backend interface is fixed by the command names in apps/supaimg-desktop/src/lib/tauri.ts and the Tauri commands in apps/supaimg-desktop/src-tauri/src/lib.rs. These names and payload shapes must remain consistent to avoid runtime errors. The workflow settings structure is defined in apps/supaimg-desktop/src/lib/workflows.ts and must continue to match workflows.json exactly. The UI package must export the specific components used by SupaIMG under @repo/ui/components/ui/_ and the utilities under @repo/ui/lib/_; no @repo/ui root export is required if all imports are updated.

Change Note: Updated progress, surprises, decision log, and outcomes to reflect completed migration steps and the blur mode default adjustment after running the test suites.
