# TranscribeJS Agent Guidelines

This document serves as the primary instruction set for AI agents and developers working on the TranscribeJS codebase.

## 1. Project Overview & Environment

**Tech Stack:**

- **Runtime:** Bun (v1.3+) - _Do not use Node.js/npm directly._
- **Frontend:** React 19, TypeScript, TailwindCSS v4.
- **Desktop:** Tauri v2 (Rust-based backend, uses `src-tauri/`).
- **Mobile:** Capacitor (Android).
- **Web Deployment:** Dockerized web app image.
- **Bundler:** Custom build scripts (`build.ts`, `dev.ts`) using `bun build`.

**Key Constraints:**

- Always use `bun` for package management and script execution.
- `dist/` is the build output directory; do not edit files there manually.
- The project uses ESM modules (`type: "module"` in `package.json`).
- **Arch Linux:** The primary development and build target is Arch Linux.

## 2. Build, Test, and Execution

### Primary Commands

| Action            | Command               | Description                                             |
| :---------------- | :-------------------- | :------------------------------------------------------ |
| **Install**       | `bun install`         | Install dependencies.                                   |
| **Dev (Web)**     | `bun run dev`         | Hot-reloading server for web/UI development.            |
| **Build (Web)**   | `bun run build`       | Compiles React/TS to `./dist`.                          |
| **Run (Tauri)**   | `bun run dev:tauri`   | Starts Tauri dev environment with hot-reload.           |
| **Build (Tauri)** | `bun run build:tauri` | Compiles optimized Tauri binary for Linux.              |
| **Pkg (Arch)**    | `makepkg -si`         | Builds and installs full Arch Linux package (PKGBUILD). |
| **Android Sync**  | `bun run cap:sync`    | Builds and syncs assets to Android project.             |

### Testing

- **Runner:** `bun test` (Built-in Bun test runner).
- **Run All Tests:** `bun test`
- **Run Single File:** `bun test path/to/file.test.ts`
- **Watch Mode:** `bun test --watch`

## 3. Code Style & Conventions

### TypeScript & React

- **Strict Mode:** TypeScript `strict: true` is enabled. No `any` unless absolutely necessary.
- **Components:** Use Functional Components with named exports.
  ```tsx
  // Good
  export function MyComponent({ prop }: Props) { ... }
  ```
- **Hooks:** Prioritize custom hooks for logic reuse. Place in `src/hooks/` if shared.
- **State:** Use `useState` for local UI state. Use Context for global app state (e.g. auth, settings).
- **Platform Detection:** Use `src/utils/platform.ts` to detect environment (e.g., `isTauriRuntime()`).
- **Window Decorations:** For Tauri, use the custom `TitleBar` component (`src/components/TitleBar.tsx`).
- **Production UX:** Do not add platform/debug notice banners in the main UI unless explicitly requested by the user.

### Styling (TailwindCSS)

- **Version:** TailwindCSS v4.
- **Usage:** Use utility classes directly in JSX.
- **Conditional Classes:** Use `clsx` and `tailwind-merge`.

  ```tsx
  import { clsx } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  // Usage: className={cn("base-class", condition && "active-class")}
  ```

### Naming Conventions

- **Files:**
  - Components: `PascalCase.tsx` (e.g., `AudioRecorder.tsx`)
  - Utilities/Services: `camelCase.ts` (e.g., `audioProcessor.ts`)
- **Variables/Functions:** `camelCase` (e.g., `handleUpload`, `isProcessing`).
- **Types/Interfaces:** `PascalCase` (e.g., `AudioMetadata`).
- **Constants:** `UPPER_SNAKE_CASE` for global constants.

## 4. Architecture & Services

- **`src/services/`**: Contains core business logic.
  - **`audio/`**: Audio processing logic (duration, conversion, splitting).
  - **`mistral/`**: API clients and interactions.
- **`src-tauri/`**: Tauri backend (Rust).
  - Contains `tauri.conf.json` for configuration.
  - Contains `Cargo.toml` for Rust dependencies.
  - Use `makepkg` (Arch) for final distribution.

## 5. Error Handling

- **Async Operations:** Wrap all async service calls (API, FS, Audio) in `try/catch`.
- **UI Feedback:** Always reflect error states in the UI (e.g., set `status` state to `'error'` and display a message).
- **Logging:** Log errors to console with context.
  ```ts
  console.error("[ServiceName] Error performing action:", err);
  ```

## 6. Anti-Regression Rules

These rules exist because of past incidents. Every rule below protects a real failure mode. Do not remove or weaken them.

### 6.1 Version Synchronization (CRITICAL)

The version string is declared in **four** files. All four MUST be updated atomically in the same commit when bumping a version:

| File                        | Field                       |
| :-------------------------- | :-------------------------- |
| `package.json`              | `"version"`                 |
| `src-tauri/tauri.conf.json` | `"version"`                 |
| `src-tauri/Cargo.toml`      | `version` under `[package]` |
| `PKGBUILD`                  | `pkgver`                    |

**Verification:** After any version bump, run:

```bash
grep -E '"version"' package.json src-tauri/tauri.conf.json && grep '^version' src-tauri/Cargo.toml && grep '^pkgver' PKGBUILD
```

All four must print the same value. If they diverge, the release is broken.

### 6.2 Tauri CSP (`connect-src`) Guard

The Content Security Policy in `src-tauri/tauri.conf.json` → `app.security.csp` controls **all** network access from the Tauri desktop webview. It is a single-line string.

- **Rule:** When adding or changing any external API endpoint (e.g. a new AI provider), add its origin to `connect-src` in the same changeset.
- **Current whitelist:** `https://api.mistral.ai`. Nothing else is allowed.
- **Failure signature:** `TypeError: Load failed` in the UI with no other useful error message.
- **Verification:** After any networking change, run `bun run dev:tauri` and validate the full flow: mic start → stop → transcription request → result displayed.

### 6.3 Dual Recording Path Integrity

Audio recording has two completely separate code paths in `App.tsx`:

| Condition              | Path   | Implementation                                                                                            |
| :--------------------- | :----- | :-------------------------------------------------------------------------------------------------------- |
| `tauriEnv && linuxEnv` | Native | Rust `cpal` via `invoke('start_native_recording')` / `invoke('stop_native_recording')`, returns WAV bytes |
| Everything else        | Web    | `navigator.mediaDevices.getUserMedia()` + `MediaRecorder` API, produces webm/ogg blob                     |

- **Rule:** Any change to recording logic must be tested on **both** paths. A fix that works on web may break Tauri native, and vice versa.
- **Rule:** Do not unify the two paths unless both are fully validated. They exist separately because `MediaRecorder` is unreliable inside Tauri's Linux webview.

### 6.4 Custom Window Title Bar

`tauri.conf.json` sets `"decorations": false`. All window chrome (drag, minimize, maximize, close) is provided by `src/components/TitleBar.tsx` using `@tauri-apps/api/window`.

- **Rule:** Never remove or break `TitleBar.tsx` without first re-enabling native decorations in `tauri.conf.json`.
- **Failure mode:** If the TitleBar breaks, the desktop window becomes undraggable and unclosable. The user must `kill` the process.

### 6.5 Tauri Capabilities

`src-tauri/capabilities/default.json` explicitly grants window control permissions (`allow-minimize`, `allow-maximize`, `allow-close`, `allow-start-dragging`, `allow-toggle-maximize`).

- **Rule:** If you add new Tauri v2 plugin commands that require capabilities, add the corresponding permissions to `default.json`. Custom `invoke_handler` commands (like `start_native_recording`) do not require capability entries.

### 6.6 Build Pipeline Integrity

The build uses two custom scripts (`build.ts` and `dev.ts`) that call the TailwindCSS CLI directly from `node_modules/.bin/tailwindcss`.

- **Rule:** If upgrading TailwindCSS, verify that both `build.ts` and `dev.ts` still resolve the CLI binary correctly.
- **Rule:** The dev server (`dev.ts`) sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. These are required for `SharedArrayBuffer` and `OfflineAudioContext`. Do not remove them or audio processing will break in some browsers.

### 6.7 CI Workflow Inventory

There are exactly **five** GitHub Actions workflows. Do not add or remove workflows without explicit approval.

| Workflow                      | Trigger                        | Purpose                                                              |
| :---------------------------- | :----------------------------- | :------------------------------------------------------------------- |
| `ci-tests.yml`                | PR to `main`                   | Runs `bun test`                                                      |
| `publish-ghcr.yml`            | Tag `v*`                       | Builds and pushes Docker image to GHCR (multi-arch: amd64 + arm64)   |
| `release-linux-desktop.yml`   | Tag `v*`                       | Builds Tauri binary (`--no-bundle`) and publishes to GitHub Releases |
| `release-windows-desktop.yml` | Tag `v*` / `workflow_dispatch` | Builds Windows Tauri binary and publishes to GitHub Releases         |
| `release-android-apk.yml`     | Tag `v*`                       | Builds signed APK and publishes to GitHub Releases                   |

- **Rule:** The Linux desktop workflow uses `ubuntu-22.04` (pinned), not `ubuntu-latest`. Do not change this — the Tauri v2 build depends on specific `libwebkit2gtk-4.1-dev` availability.
- **Rule:** The desktop build uses `--no-bundle`. No AppImage, deb, or rpm formats are produced. Only the raw binary is released.
- **Rule:** Android signing requires four secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The workflow validates all four exist before building.
- **Rule:** The Windows workflow supports `workflow_dispatch` with a `release_tag` input to manually attach assets to an existing release. Do not remove this trigger.

### 6.8 Android Build Integrity

- **Capacitor sync:** `bun run cap:sync` must be run before any Android build to copy `dist/` into `android/app/src/main/assets/public/`.
- **Gradle properties:** `variables.gradle` controls `minSdkVersion` (24), `compileSdkVersion` (36), and `targetSdkVersion` (36). Changing these affects device compatibility.
- **Java version:** The build requires Java 21. Both `gradle.properties` and the CI workflow pin to JDK 21.

### 6.9 Docker Build Integrity

- **Multi-stage:** The `Dockerfile` uses `oven/bun:1` (builder) → `oven/bun:1-slim` (runtime).
- **Serve command:** Production uses `bun x serve dist -p 3000 --single`. The `--single` flag is required for SPA routing.
- **Rule:** Do not add runtime dependencies to the slim image. If a new dependency is needed at runtime, it must be explicitly justified.

### 6.10 Header Layout Integrity

The application uses a custom sticky header that sits below the window title bar.

- **Rule:** The header container in `src/App.tsx` must have at least `mb-14` (56px) or equivalent bottom margin.
- **Reasoning:** In the desktop app, the header bar (containing the logo and settings) can visually collapse onto or touch the main action buttons ("Upload Audio" / "Record Voice") if the margin is too small, especially when window decorations are custom.
- **Verification:** Visually verify that there is a clear gap between the header pill and the action cards in both web (`bun run dev`) and desktop (`bun run dev:tauri`) modes.

## 7. Workflow Rules for Agents

1.  **Read First:** Always read `package.json` and `README.md` to understand current context.
2.  **Branch First:** Before making any change to source code (`src/`, `src-tauri/`, `android/`), create a dedicated branch from an up-to-date `main`. Never commit source changes directly to `main`. See §9 for the full branching model.
3.  **Conventional Commits:** Every commit message must follow the Conventional Commits standard defined in §9.5. Messages like `"wip"`, `"fix stuff"`, or `"iteration 3"` are not acceptable.
4.  **Build Before PR:** Run `bun test && bun run build` locally and ensure both pass before opening a Pull Request. A PR that breaks CI is a blocking error.
5.  **PR Before Merge:** No code reaches `main` without an open PR and a green `ci-tests.yml` run. Direct pushes to `main` for source changes are forbidden.
6.  **Verify:** After making changes, run `bun run build` to ensure no compilation errors.
7.  **Clean Up:** Remove unused files or imports introduced during refactoring.
8.  **No Placeholders:** Implementation should be complete. If a placeholder is strictly necessary, mark it with `TODO:`.
9.  **Milestones Execution:** Upon start, read the `MILESTONES.md` file. Start working on the first unchecked milestone (`[ ]`). Once completed, update `MILESTONES.md` to mark it as checked (`[x]`).
10. **Release Branch Hygiene:** Before creating/pushing a release tag, run `git status --short`. If there are modified tracked source files (e.g. `src/**`, `src-tauri/**`), do not publish until they are either committed intentionally or explicitly excluded by the user.
11. **Desktop Release Verification:** After a release build, verify that the Linux binary artifact is present and valid in GitHub Releases.

## 8. Repository & CI/CD (GitHub)

- **Git Hosting:** The canonical remote is GitHub (`git@github.com:JoelShepard/TranscribeAPP.git`).
- **Container Registry:** Docker images are published to **GHCR** (`ghcr.io`).
- **Workflow File:** Use `.github/workflows/publish-ghcr.yml` for container build/publish.
- **Trigger Policy:** All release workflows run only on pushes of tags matching `v*`.
- **Auth Policy:** Prefer `${{ secrets.GITHUB_TOKEN }}` for GHCR publish. Do not introduce a PAT unless explicitly required.
- **Naming:** GHCR image names must be lowercase (`ghcr.io/<owner>/<repo>`).

### Release Tag Push Flow

To trigger all release workflows, create and push an annotated version tag after pushing `main`:

```bash
git add .
git commit -m "chore: prepare release"
git push origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Compact variant:

```bash
git commit -m "chore: prepare release"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --follow-tags
```

## 9. Git Branching & Development Workflow

This section defines the authoritative, end-to-end Git workflow for this repository. Its primary goal is to guarantee that `main` is always stable, buildable, and production-ready. All feature development, bug fixing, and release preparation happens in isolated branches and lands on `main` exclusively through reviewed Pull Requests.

### 9.1 Branch Model

The repository uses a three-tier branch model:

| Tier | Branch Pattern | Scope | Lifetime | Merges Into |
| :--- | :------------- | :---- | :------- | :---------- |
| **Stable** | `main` | Production-ready state of the codebase | Permanent | — |
| **Work** | `feat/*`, `fix/*`, `chore/*`, `refactor/*`, `docs/*`, `test/*`, `ci/*`, `perf/*` | Single unit of work (one feature, one fix) | Short (hours to days) | `main` via PR |
| **Release** | `release/vX.Y.Z` | Version freeze, version bump, changelog | Very short (hours) | `main` via PR, then tagged |

**Branch naming convention — mandatory:**

| Prefix | When to use | Example |
| :----- | :---------- | :------ |
| `feat/` | Adding new user-facing functionality | `feat/audio-waveform-visualizer` |
| `fix/` | Correcting a bug (any severity) | `fix/tauri-csp-load-failed` |
| `chore/` | Build scripts, dependencies, tooling, CI config | `chore/update-bun-1.4` |
| `refactor/` | Code restructuring with no behavior change | `refactor/settings-panel-hooks` |
| `docs/` | Documentation-only changes | `docs/update-agents-workflow` |
| `test/` | Adding or fixing tests | `test/audio-duration-edge-cases` |
| `ci/` | GitHub Actions workflow changes | `ci/pin-ubuntu-runner` |
| `perf/` | Performance improvements | `perf/reduce-bundle-size` |
| `release/` | Release preparation | `release/v0.4.0` |

Names must be lowercase, hyphen-separated, and descriptive. No numbers-only names, no names like `my-branch` or `test2`.

### 9.2 Feature Branch Lifecycle

Every unit of work follows these steps in order. Do not skip or reorder them.

**Step 1 — Sync from main:**
```bash
git checkout main
git pull origin main
```
Always start from the latest `main`. Never branch from a stale local copy.

**Step 2 — Create the branch:**
```bash
git checkout -b feat/my-feature-name
```

**Step 3 — Develop with atomic commits:**

Make small, focused commits as you work. Each commit should represent a single logical change that leaves the code in a coherent state. Use the Conventional Commits format (§9.5) for every commit message.

```bash
# Good: atomic, descriptive
git commit -m "feat(audio): add waveform canvas component"
git commit -m "feat(audio): wire waveform to MediaRecorder stream"

# Bad: vague, non-atomic
git commit -m "wip"
git commit -m "more changes"
```

**Step 4 — Validate locally before pushing:**
```bash
bun test && bun run build
```
Both must pass with zero errors. A branch that breaks the build must not be pushed.

**Step 5 — Push the branch to origin:**
```bash
git push -u origin feat/my-feature-name
```

**Step 6 — Open a Pull Request:**
```bash
gh pr create \
  --title "feat(audio): add waveform visualizer" \
  --body "$(cat <<'EOF'
## Description
Adds a real-time waveform canvas that renders microphone input during recording.

## Type of change
- [x] feat: new functionality
- [ ] fix: bug correction
- [ ] chore/refactor: maintenance

## Local validation
- [x] `bun test` passes
- [x] `bun run build` passes

## Anti-regression checks (§6)
- [x] No changes to the dual recording path (§6.3)
- [x] No changes to CSP (§6.2)
- [x] No partial version bump (§6.1)
EOF
)"
```

**Step 7 — Wait for CI:**

The `ci-tests.yml` workflow must complete with a green status before any merge is considered. A red CI run is a hard blocker. Fix the issue on the branch, push again, and wait for the CI to re-run.

**Step 8 — Squash and merge into main:**

Use **Squash and Merge** exclusively. This collapses all branch commits into one clean, atomic commit on `main`. The resulting commit message must follow Conventional Commits format.

```bash
# Via GitHub CLI
gh pr merge <PR-NUMBER> --squash --delete-branch
```

The `--delete-branch` flag is mandatory. Remote branches must be cleaned up immediately after merge.

**Step 9 — Clean up local branch:**
```bash
git checkout main
git pull origin main
git branch -d feat/my-feature-name
```

### 9.3 Golden Rules for `main`

These rules are absolute. Any agent or developer violating them introduces instability into the production branch.

**Forbidden — never do these:**

- Direct `git push origin main` for any change to `src/`, `src-tauri/`, `android/`, `build.ts`, `dev.ts`, `package.json`, `Cargo.toml`, `Dockerfile`, or any GitHub Actions workflow.
- Merging a branch that has a failing `bun test` or `bun run build`.
- Merging a branch that has not been reviewed (via open PR).
- Using `git push --force` on `main` under any circumstance.
- Using `git commit --amend` on commits that have already been pushed to `main`.
- Merging a branch that is behind `main` without first updating it.

**Allowed — direct commits to `main` (documentation exceptions only):**

The only files that may be committed directly to `main` without a PR are pure documentation files with no runtime impact: `AGENTS.md`, `README.md`, `MILESTONES.md`. Even for these, a branch is strongly preferred.

**Invariant:** After every merge, `bun run build` on `main` must succeed. If it does not, the merge must be reverted immediately:

```bash
git revert <merge-commit-sha>
git push origin main
```

### 9.4 Pull Request Checklist

Every PR body must include the following checklist. Copy it verbatim and check off all applicable items before requesting a review.

```markdown
## Description
<!-- One paragraph explaining what this PR does and why. -->

## Type of change
- [ ] `feat`: new user-facing functionality
- [ ] `fix`: bug correction
- [ ] `chore`: build, deps, tooling
- [ ] `refactor`: code restructuring, no behavior change
- [ ] `ci`: GitHub Actions workflow change
- [ ] `docs`: documentation only
- [ ] `perf`: performance improvement
- [ ] `test`: test additions or fixes

## Local validation
- [ ] `bun test` passes with zero failures
- [ ] `bun run build` completes with zero errors

## Anti-regression checks (see §6)
- [ ] §6.1 — No version bump, OR all four version files updated atomically
- [ ] §6.2 — No new external API origin, OR `connect-src` updated in `tauri.conf.json`
- [ ] §6.3 — No changes to recording logic, OR both Web and Native paths tested
- [ ] §6.4 — `TitleBar.tsx` not broken, OR `decorations` re-enabled in `tauri.conf.json`
- [ ] §6.6 — No TailwindCSS upgrade, OR both `build.ts` and `dev.ts` verified
- [ ] §6.10 — No header layout changes, OR `mb-14` margin preserved in `App.tsx`

## Screenshots / recordings (if UI change)
<!-- Attach a screenshot or screen recording if this PR touches the UI. -->
```

### 9.5 Conventional Commits Standard

Every commit message in this repository — whether on a feature branch or the squash-merge commit landing on `main` — must follow this format:

```
<type>(<optional-scope>): <imperative description in lowercase>
```

- **type**: one of the values from the table below (required).
- **scope**: the part of the codebase affected, in parentheses (optional but recommended).
- **description**: a short imperative phrase (max ~72 chars), lowercase, no trailing period.

**Valid types:**

| Type | When to use | Triggers SemVer |
| :--- | :---------- | :-------------- |
| `feat` | Adds a new user-facing feature | Minor bump |
| `fix` | Corrects a bug | Patch bump |
| `chore` | Build scripts, dependency updates, tooling, non-source maintenance | No bump |
| `refactor` | Code restructuring with no change in external behavior | No bump |
| `docs` | Documentation-only changes | No bump |
| `test` | Adding or modifying tests | No bump |
| `ci` | Changes to GitHub Actions workflows | No bump |
| `perf` | Performance improvements | Patch bump |

**Examples — correct:**

```
feat(audio): add real-time waveform visualizer during recording
fix(tauri): resolve TypeError on Mistral API call due to missing CSP entry
chore(deps): update bun to 1.4.0 and audit lockfile
refactor(settings): extract API key input into dedicated hook
ci: pin ubuntu-22.04 in linux release workflow
docs(agents): add §9 git branching workflow
test(audio): add edge case for zero-duration file uploads
perf(build): enable bun bundler minification for production
```

**Examples — forbidden:**

```
wip
fix stuff
update
more changes
iteration 3
Ralph iteration 5: work in progress
final fix
```

**Breaking changes:** If a commit introduces a breaking change (requires a major version bump), append `!` after the type and add a `BREAKING CHANGE:` footer:

```
feat(api)!: replace Mistral client with multi-provider interface

BREAKING CHANGE: The `MISTRAL_API_KEY` setting has been renamed to `AI_API_KEY`.
```

### 9.6 Release Flow

Every release follows these five steps in order. No shortcuts.

**Step 1 — Create the release branch from main:**
```bash
git checkout main
git pull origin main
git checkout -b release/vX.Y.Z
```

**Step 2 — Bump the version (atomically in one commit):**

Update all four version files in a single commit (see §6.1 for the full list):

```bash
# Edit package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, PKGBUILD
# Then commit all four at once:
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml PKGBUILD
git commit -m "chore(release): bump version to X.Y.Z"
```

**Step 3 — Verify version consistency:**
```bash
grep -E '"version"' package.json src-tauri/tauri.conf.json \
  && grep '^version' src-tauri/Cargo.toml \
  && grep '^pkgver' PKGBUILD
```
All four lines must print the same version string. If they diverge, fix before proceeding.

**Step 4 — Run final validation:**
```bash
bun test && bun run build
```
Both must pass. No release goes out with a broken build.

**Step 5 — Open the release PR and merge:**
```bash
git push -u origin release/vX.Y.Z
gh pr create \
  --title "chore(release): prepare vX.Y.Z" \
  --body "Release vX.Y.Z — version bump across all four manifest files."
```

After the PR is merged into `main` via Squash and Merge, create and push the annotated tag:

```bash
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Pushing the tag triggers all five release workflows simultaneously (`publish-ghcr.yml`, `release-linux-desktop.yml`, `release-windows-desktop.yml`, `release-android-apk.yml`). Monitor all of them on GitHub Actions before announcing the release.
