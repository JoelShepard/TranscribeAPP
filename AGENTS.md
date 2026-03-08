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
- **Hooks:** Prioritize custom hooks for logic reuse. Place in `src/hooks/` if shared.
- **State:** Use `useState` for local UI state. Use Context for global app state (e.g. auth, settings).
- **Platform Detection:** Use `src/utils/platform.ts` to detect environment (e.g., `isTauriRuntime()`).
- **Production UX:** Do not add platform/debug notice banners in the main UI unless explicitly requested by the user.

### Styling (TailwindCSS)

- **Version:** TailwindCSS v4.
- **Usage:** Use utility classes directly in JSX.
- **Conditional Classes:** Use `clsx` and `tailwind-merge` (`cn()` utility pattern).

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

## 5. Error Handling

- **Async Operations:** Wrap all async service calls (API, FS, Audio) in `try/catch`.
- **UI Feedback:** Always reflect error states in the UI (e.g., set `status` state to `'error'` and display a message).
- **Logging:** Log errors to console with context: `console.error("[ServiceName] Error performing action:", err)`.

## 6. Anti-Regression Rules

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

### 6.2 Build Pipeline Integrity

The build uses two custom scripts (`build.ts` and `dev.ts`) that call the TailwindCSS CLI directly from `node_modules/.bin/tailwindcss`.

- **Rule:** If upgrading TailwindCSS, verify that both `build.ts` and `dev.ts` still resolve the CLI binary correctly.

### 6.3 Docker Build Integrity

- **Multi-stage:** The `Dockerfile` uses `oven/bun:1` (builder) → `oven/bun:1-slim` (runtime).
- **Serve command:** Production uses `bun x serve dist -p 3000 --single`. The `--single` flag is required for SPA routing.

## 7. Workflow Rules for Agents

1.  **Read First:** Always read `package.json` and `README.md` to understand current context.
2.  **Branch First:** Create a dedicated branch from up-to-date `main` before any source change.
3.  **Conventional Commits:** Every commit must follow Conventional Commits format.
4.  **Build Before PR:** `bun test && bun run build` must pass before opening a Pull Request.
5.  **PR Before Merge:** No code reaches `main` without an open PR and a green `ci-tests.yml` run.
6.  **Verify:** After making changes, run `bun run build` to ensure no compilation errors.
7.  **Clean Up:** Remove unused files or imports introduced during refactoring.
8.  **No Placeholders:** Implementation should be complete. If a placeholder is strictly necessary, mark it with `TODO:`.
9.  **Milestones Execution:** Upon start, read the `MILESTONES.md` file. Start working on the first unchecked milestone (`[ ]`). Once completed, update `MILESTONES.md` to mark it as checked (`[x]`).

## 8. Specialist Skills

When performing specialized tasks, the agent MUST load the corresponding skill to ensure compliance with advanced standards:

| Skill | Location | Purpose |
| :--- | :--- | :--- |
| `git-workflow` | `.agents/skills/git-workflow/SKILL.md` | Branching, commits, PRs, and version bumping. |
| `tauri-development` | `.agents/skills/tauri-development/SKILL.md` | Desktop development, Rust backend, CSP, and TitleBar. |
| `audio-standards` | `.agents/skills/audio-standards/SKILL.md` | Audio recording paths (Native vs Web) and processing rules. |
| `mobile-android` | `.agents/skills/mobile-android/SKILL.md` | Android builds, Capacitor sync, and Gradle config. |
