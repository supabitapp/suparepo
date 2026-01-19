# Move SupaIMG distribution to GitHub Releases

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

There is no PLANS.md file in this repository at the time this plan was created.

## Purpose / Big Picture

SupaIMG currently downloads desktop updates and ML models from Cloudflare R2 (the appcast.supaimg.app domain). The goal is to move all SupaIMG distribution artifacts (desktop installers, updater metadata, and model files) onto GitHub Releases, hosted in a dedicated repo at supabitapp/supaimg. After this change, the SupaIMG desktop updater and marketing site will fetch update metadata from GitHub Releases, model downloads will come from GitHub Releases, and the release workflow will publish assets to GitHub Releases instead of R2. This can be verified by hitting the new update.json endpoint on GitHub, seeing model downloads succeed, and confirming a tagged release uploads assets to the new repo.

## Progress

- [x] (2026-01-19 17:30Z) Created initial ExecPlan and captured current R2 usage points (update.json, model downloads, and release workflow uploads).
- [x] (2026-01-19 17:52Z) Created supabitapp/supaimg repo with an initial commit and published models/v1 release assets.
- [x] (2026-01-19 17:52Z) Replaced Cloudflare R2 URLs and endpoints in application code and CI with GitHub Releases URLs.
- [x] (2026-01-19 17:52Z) Updated the SupaIMG release workflow to publish assets and update metadata to supabitapp/supaimg GitHub Releases.
- [ ] (2026-01-19 17:52Z) Validate downloads, update metadata, and model fetches work against GitHub Releases.
- [ ] (2026-01-19 18:02Z) Create a release tag matching the updated app version and verify assets upload in the new workflow.

## Surprises & Discoveries

- Observation: R2 is currently used in three places: updater endpoint in tauri.conf.json, model download base URLs in Rust, and the supaimg-release workflow that uploads release artifacts and update.json to R2.
  Evidence: apps/supaimg-desktop/src-tauri/tauri.conf.json, apps/supaimg-desktop/src-tauri/src/background_removal.rs, apps/supaimg-desktop/src-tauri/src/text_blur.rs, .github/workflows/supaimg-release.yml.
- Observation: GitHub releases cannot be published from a repository with zero commits; an initial commit (README) was required before publishing models/v1.
  Evidence: gh release edit models/v1 returned HTTP 422 "Repository is empty" until a README commit was pushed.

## Decision Log

- Decision: Use GitHub Releases in a new repository named supabitapp/supaimg as the single source of truth for SupaIMG installers, updater metadata, and ML model assets.
  Rationale: This meets the requirement to move away from Cloudflare R2 and keeps all distribution artifacts in one place with stable, versioned URLs.
  Date: 2026-01-19 17:30Z

- Decision: Publish update.json as a release asset and point the app updater and marketing site to the stable latest-download URL on GitHub Releases.
  Rationale: It keeps the updater schema unchanged while removing the need for a separate R2-hosted appcast domain.
  Date: 2026-01-19 17:30Z

- Decision: Store ML model files as assets on a dedicated GitHub release tag (for example models/v1) in supabitapp/supaimg, and update model download URLs to point to that tag.
  Rationale: Model files are versioned independently from the app binary releases and need stable URLs; a dedicated tag avoids changing app code for each app release.
  Date: 2026-01-19 17:30Z

- Decision: Use the models tag models/v1 with asset names model_quantized.onnx and pp-ocrv5-server-det.onnx.
  Rationale: Keeps filenames short, matches existing local filenames, and avoids path-based asset names that GitHub Releases do not support.
  Date: 2026-01-19 17:52Z

- Decision: Bump SupaIMG version to 1.4.1 so the release tag can be created without reusing the existing supaimg/v1.4.0 tag.
  Rationale: The release workflow requires the tag to match the app version; 1.4.0 already exists.
  Date: 2026-01-19 18:02Z

## Outcomes & Retrospective

- Pending. This will be completed after implementation and validation.

## Context and Orientation

This repo is a Turborepo monorepo. SupaIMG has two relevant apps: the desktop app (apps/supaimg-desktop) and the marketing site (apps/supaimg.app). The desktop app uses the Tauri updater plugin; its update endpoint is configured in apps/supaimg-desktop/src-tauri/tauri.conf.json under plugins.updater.endpoints. The marketing site fetches update.json in apps/supaimg.app/src/App.tsx and constructs download URLs for DMG/MSI files. SupaIMG downloads ML models at runtime from hard-coded URLs in apps/supaimg-desktop/src-tauri/src/background_removal.rs and apps/supaimg-desktop/src-tauri/src/text_blur.rs. The CI workflow .github/workflows/supaimg-ci.yml also downloads those model files during tests. The release workflow .github/workflows/supaimg-release.yml builds installers, uploads artifacts to GitHub Releases, and then uploads copies and update.json to Cloudflare R2; we will replace that R2 step with GitHub Releases.

Terms used below:
- Update metadata (update.json): A JSON file used by Tauri updater to discover the latest version and download URLs.
- Release assets: Files attached to a GitHub Release; accessible via stable download URLs.
- Models release: A dedicated GitHub Release tag that stores ML model files used by the desktop app.

## Plan of Work

First, create (or confirm) the new GitHub repository supabitapp/supaimg. This repo will hold GitHub Releases only; the source code remains in this monorepo. Ensure the repo exists and has releases enabled. Create a long-lived models release tag (for example models/v1) and upload the model files currently hosted at appcast.supaimg.app. Record the exact asset names; the app and CI will use these names in their URLs.

Next, update application code to point at GitHub Releases. In apps/supaimg-desktop/src-tauri/tauri.conf.json, replace the updater endpoint with the GitHub Releases latest download URL for update.json (for example https://github.com/supabitapp/supaimg/releases/latest/download/update.json). In apps/supaimg.app/src/App.tsx, update UPDATE_JSON_URL to the same endpoint and update the base URL builder to use the GitHub Releases download URL for the tagged release (for example https://github.com/supabitapp/supaimg/releases/download/supaimg/v${version}). In apps/supaimg-desktop/src-tauri/src/background_removal.rs and apps/supaimg-desktop/src-tauri/src/text_blur.rs, replace MODEL_BASE_URL and MODEL_REMOTE_PATH so they point at the models release assets in GitHub Releases. Update .github/workflows/supaimg-ci.yml to download the model files from the new GitHub Releases URLs as well.

Then, update the release workflow .github/workflows/supaimg-release.yml to publish assets and update.json to the supabitapp/supaimg repo. Remove all R2 credentials and awscli usage. Instead, use gh release create and gh release upload with --repo supabitapp/supaimg and a token that has write access to that repo (store this token as a secret like SUPAIMG_RELEASE_TOKEN). During the macOS and Windows build jobs, upload the canonical asset names expected by update.json and the marketing site (for example supaimg_aarch64.app.tar.gz, supaimg_aarch64.app.tar.gz.sig, supaimg_aarch64.dmg, supaimg_x64-setup.exe, supaimg_x64-setup.exe.sig, supaimg_x64.msi). In the publish-release job, download the signature assets from the release (gh release download) and generate update.json with URLs pointing to the GitHub Releases download URLs for that tag. Upload update.json as a release asset and finally publish the release.

Finally, validate that the updater and marketing site can retrieve update.json and that the model downloads succeed. Use curl to fetch update.json from the new GitHub release URL, confirm the JSON includes correct version and platform URLs, and verify those URLs download files. For the desktop app, run the updater check or use the existing download_update_to_cache flow to verify progress events against GitHub. For CI, run the supaimg-ci workflow (or run locally) and confirm model downloads no longer use appcast.supaimg.app.

## Concrete Steps

1) Create or confirm the release repo in the supabitapp GitHub org.
   - From a terminal with GitHub CLI authenticated:
     - Run in any directory:
       - gh repo view supabitapp/supaimg
       - If it does not exist, create it:
         - gh repo create supabitapp/supaimg --public --description "SupaIMG release assets" --confirm
   - Ensure releases are enabled (default for new repos).
   - If the repo is empty, push an initial commit (for example a README) so releases can be published.

2) Create the models release in supabitapp/supaimg and upload model assets.
   - Decide the models tag name, for example models/v1.
   - Download the current model files (from appcast.supaimg.app) and upload them as release assets with stable names.
   - Example with gh (run in a temp directory):
     - curl -L -o model_quantized.onnx https://appcast.supaimg.app/supaimg/assets/onnx/model_quantized.onnx
     - curl -L -o pp-ocrv5-server-det.onnx https://appcast.supaimg.app/supaimg/assets/onnx/pp-ocrv5-server-det/det.onnx
     - gh release create models/v1 --repo supabitapp/supaimg --title "SupaIMG Models v1" --notes "Model assets for SupaIMG" --draft
     - gh release upload models/v1 model_quantized.onnx pp-ocrv5-server-det.onnx --repo supabitapp/supaimg --clobber
     - gh release edit models/v1 --repo supabitapp/supaimg --draft=false
   - Record these asset names; the code will use them.

3) Update code and CI to use GitHub Releases endpoints.
   - Edit apps/supaimg-desktop/src-tauri/tauri.conf.json:
     - Replace plugins.updater.endpoints with the GitHub Releases latest download URL for update.json.
   - Edit apps/supaimg.app/src/App.tsx:
     - Set UPDATE_JSON_URL to the same GitHub Releases latest download URL.
     - Update the base download URL to https://github.com/supabitapp/supaimg/releases/download/supaimg/v${version}.
   - Edit apps/supaimg-desktop/src-tauri/src/background_removal.rs:
     - Replace MODEL_BASE_URL with https://github.com/supabitapp/supaimg/releases/download/models/v1 (or your chosen tag).
     - Update the URL formatting so it points to the model asset names created in step 2 (for example model_quantized.onnx).
   - Edit apps/supaimg-desktop/src-tauri/src/text_blur.rs:
     - Replace MODEL_BASE_URL and MODEL_REMOTE_PATH similarly.
   - Edit .github/workflows/supaimg-ci.yml:
     - Replace model download curl URLs with the GitHub Releases download URLs for the models tag.

4) Update the supaimg-release workflow to use GitHub Releases instead of R2.
   - Edit .github/workflows/supaimg-release.yml:
     - Remove awscli installs and all R2-related env vars and steps.
     - Add a release target repo variable, for example SUPAIMG_RELEASE_REPO=supabitapp/supaimg.
     - Use a token secret (SUPAIMG_RELEASE_TOKEN) with repo:write access to supabitapp/supaimg for gh commands; set GH_TOKEN or GITHUB_TOKEN accordingly.
     - Ensure the release exists in the target repo before uploads (gh release view/create --repo supabitapp/supaimg).
     - Upload canonical asset names to the target repo release. If the build output names differ, copy or rename before upload so the asset names are stable.
     - In publish-release job, use gh release download to fetch the .sig files from the target repo release. Generate update.json with URLs pointing to https://github.com/supabitapp/supaimg/releases/download/${TAG}/<asset-name>.
     - Upload update.json to the target repo release and publish the release.

5) Validation.
   - From any machine:
     - curl -L https://github.com/supabitapp/supaimg/releases/latest/download/update.json
     - Verify the JSON includes the expected version and URLs.
     - curl -I one of the URLs from update.json to confirm a 302/200 response.
   - In this repo:
     - Run bun run supaimg.app:dev and confirm the download buttons link to GitHub Releases URLs.
     - Run bun run supaimg.app:build to ensure no build errors.
     - Run bun run supaimg-desktop:dev (or the relevant update check flow) and confirm updater metadata loads.

## Validation and Acceptance

Acceptance is met when:
- apps/supaimg.app loads and its download buttons point to GitHub Releases URLs under supabitapp/supaimg.
- apps/supaimg-desktop checks for updates using update.json from GitHub Releases and can download the update payloads.
- ML model downloads succeed using the GitHub Releases models tag URLs, both in local app runs and in .github/workflows/supaimg-ci.yml.
- .github/workflows/supaimg-release.yml publishes a tagged release that includes update.json and all required binaries, without any R2 usage or secrets.

## Idempotence and Recovery

All steps are safe to repeat. Re-running gh release upload with --clobber overwrites assets. If a release is created with the wrong tag or assets, delete and recreate the release in supabitapp/supaimg, then re-run the workflow. If code changes need rollback, revert the updated URLs to appcast.supaimg.app and restore the R2 steps in the workflow.

## Artifacts and Notes

Expected update.json shape (example):

  {
    "version": "1.4.0",
    "notes": "Release 1.4.0",
    "pub_date": "2026-01-19T17:30:00Z",
    "platforms": {
      "darwin-aarch64": {
        "signature": "<base64-signature>",
        "url": "https://github.com/supabitapp/supaimg/releases/download/supaimg/v1.4.0/supaimg_aarch64.app.tar.gz"
      },
      "windows-x86_64": {
        "signature": "<base64-signature>",
        "url": "https://github.com/supabitapp/supaimg/releases/download/supaimg/v1.4.0/supaimg_x64-setup.exe"
      }
    }
  }

## Interfaces and Dependencies

- GitHub Releases in repo supabitapp/supaimg.
- gh CLI for creating and uploading release assets.
- Tauri updater expects update.json with platform URLs and signatures; keep this schema unchanged.
- No Cloudflare R2 or awscli dependency after migration.

---
Change log: 2026-01-19 17:30Z - Initial ExecPlan created.
Change log: 2026-01-19 17:52Z - Updated progress, recorded models asset names, and noted GitHub release requirement for an initial commit.
Change log: 2026-01-19 18:02Z - Noted version bump decision to enable a new release tag.
