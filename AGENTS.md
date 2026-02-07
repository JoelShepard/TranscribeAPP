# TranscribeJS Agent Guidelines

This document serves as the primary instruction set for AI agents and developers working on the TranscribeJS codebase.

## 1. Project Overview & Environment

**Tech Stack:**
- **Runtime:** Bun (v1.3+) - *Do not use Node.js/npm directly.*
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
| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `bun install` | Install dependencies. |
| **Dev (Web)** | `bun run dev` | Hot-reloading server for web/UI development. |
| **Build (Web)** | `bun run build` | Compiles React/TS to `./dist`. |
| **Run (Tauri)** | `bun run dev:tauri` | Starts Tauri dev environment with hot-reload. |
| **Build (Tauri)** | `bun run build:tauri` | Compiles optimized Tauri binary for Linux. |
| **Pkg (Arch)** | `makepkg -si` | Builds and installs full Arch Linux package (PKGBUILD). |
| **Android Sync** | `bun run cap:sync` | Builds and syncs assets to Android project. |

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
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
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
  console.error('[ServiceName] Error performing action:', err);
  ```

## 6. Anti-Regression Rules

These rules exist because of past incidents. Every rule below protects a real failure mode. Do not remove or weaken them.

### 6.1 Version Synchronization (CRITICAL)

The version string is declared in **four** files. All four MUST be updated atomically in the same commit when bumping a version:

| File | Field |
| :--- | :--- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` under `[package]` |
| `PKGBUILD` | `pkgver` |

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

| Condition | Path | Implementation |
| :--- | :--- | :--- |
| `tauriEnv && linuxEnv` | Native | Rust `cpal` via `invoke('start_native_recording')` / `invoke('stop_native_recording')`, returns WAV bytes |
| Everything else | Web | `navigator.mediaDevices.getUserMedia()` + `MediaRecorder` API, produces webm/ogg blob |

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

There are exactly **four** GitHub Actions workflows. Do not add or remove workflows without explicit approval.

| Workflow | Trigger | Purpose |
| :--- | :--- | :--- |
| `ci-tests.yml` | PR to `main` | Runs `bun test` |
| `publish-ghcr.yml` | Tag `v*` | Builds and pushes Docker image to GHCR (multi-arch: amd64 + arm64) |
| `release-linux-desktop.yml` | Tag `v*` | Builds Tauri binary (`--no-bundle`) and publishes to GitHub Releases |
| `release-android-apk.yml` | Tag `v*` | Builds signed APK and publishes to GitHub Releases |

- **Rule:** The Linux desktop workflow uses `ubuntu-22.04` (pinned), not `ubuntu-latest`. Do not change this — the Tauri v2 build depends on specific `libwebkit2gtk-4.1-dev` availability.
- **Rule:** The desktop build uses `--no-bundle`. No AppImage, deb, or rpm formats are produced. Only the raw binary is released.
- **Rule:** Android signing requires four secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The workflow validates all four exist before building.

### 6.8 Android Build Integrity

- **Capacitor sync:** `bun run cap:sync` must be run before any Android build to copy `dist/` into `android/app/src/main/assets/public/`.
- **Gradle properties:** `variables.gradle` controls `minSdkVersion` (24), `compileSdkVersion` (36), and `targetSdkVersion` (36). Changing these affects device compatibility.
- **Java version:** The build requires Java 21. Both `gradle.properties` and the CI workflow pin to JDK 21.

### 6.9 Docker Build Integrity

- **Multi-stage:** The `Dockerfile` uses `oven/bun:1` (builder) → `oven/bun:1-slim` (runtime).
- **Serve command:** Production uses `bun x serve dist -p 3000 --single`. The `--single` flag is required for SPA routing.
- **Rule:** Do not add runtime dependencies to the slim image. If a new dependency is needed at runtime, it must be explicitly justified.

## 7. Workflow Rules for Agents

1.  **Read First:** Always read `package.json` and `README.md` to understand current context.
2.  **Verify:** After making changes, run `bun run build` to ensure no compilation errors.
3.  **Clean Up:** Remove unused files or imports introduced during refactoring.
4.  **No Placeholders:** Implementation should be complete. If a placeholder is strictly necessary, mark it with `TODO:`.
5.  **Milestones Execution:** Upon start, read the `MILESTONES.md` file. Start working on the first unchecked milestone (`[ ]`). Once completed, update `MILESTONES.md` to mark it as checked (`[x]`).
6.  **Release Branch Hygiene:** Before creating/pushing a release tag, run `git status --short`. If there are modified tracked source files (e.g. `src/**`, `src-tauri/**`), do not publish until they are either committed intentionally or explicitly excluded by the user.
7.  **Desktop Release Verification:** After a release build, verify that the Linux binary artifact is present and valid in GitHub Releases.

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
