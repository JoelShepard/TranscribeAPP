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
  - Keep the Linux AppImage runtime environment safeguards in `src-tauri/src/lib.rs` (AppImage startup compatibility).
  - Use `makepkg` (Arch) for final distribution.

## 5. Error Handling

- **Async Operations:** Wrap all async service calls (API, FS, Audio) in `try/catch`.
- **UI Feedback:** Always reflect error states in the UI (e.g., set `status` state to `'error'` and display a message).
- **Logging:** Log errors to console with context.
  ```ts
  console.error('[ServiceName] Error performing action:', err);
  ```

## 6. Workflow Rules for Agents

1.  **Read First:** Always read `package.json` and `README.md` to understand current context.
2.  **Verify:** After making changes, run `bun run build` to ensure no compilation errors.
3.  **Clean Up:** Remove unused files or imports introduced during refactoring.
4.  **No Placeholders:** implementation should be complete. If a placeholder is strictly necessary, mark it with `TODO:`.
5.  **Milestones Execution:** Upon start, read the `MILESTONES.md` file. Start working on the first unchecked milestone (`[ ]`). Once completed, update `MILESTONES.md` to mark it as checked (`[x]`).
6.  **Release Branch Hygiene:** Before creating/pushing a release tag, run `git status --short`. If there are modified tracked source files (e.g. `src/**`, `src-tauri/**`), do not publish until they are either committed intentionally or explicitly excluded by the user.
7.  **Desktop Release Smoke Test:** For Linux AppImage releases, require a startup smoke test in CI (`xvfb-run` + timeout) before uploading assets to GitHub Releases.
8.  **Milestone Verification Gate:** Do not mark desktop-release milestones complete until both Linux artifacts (AppImage + raw binary) are built from the same commit and validated.

## 7. Repository & CI/CD (GitHub)

- **Git Hosting:** The canonical remote is GitHub (`git@github.com:JoelShepard/TranscribeAPP.git`).
- **Container Registry:** Docker images are published to **GHCR** (`ghcr.io`).
- **Workflow File:** Use `.github/workflows/publish-ghcr.yml` for container build/publish.
- **Trigger Policy:** Container publish runs only on pushes of tags matching `v*`.
- **Auth Policy:** Prefer `${{ secrets.GITHUB_TOKEN }}` for GHCR publish. Do not introduce a PAT unless explicitly required.
- **Naming:** GHCR image names must be lowercase (`ghcr.io/<owner>/<repo>`).

### Release Tag Push Flow

To trigger container publish, create and push an annotated version tag after pushing `main`:

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
