# TranscribeJS Agent Guidelines

This document serves as the primary instruction set for AI agents and developers working on the TranscribeJS codebase.

## 1. Project Overview & Environment

**Tech Stack:**
- **Runtime:** Bun (v1.3+) - *Do not use Node.js/npm directly.*
- **Frontend:** React 19, TypeScript, TailwindCSS v4.
- **Desktop:** Electron (Main process in `electron/`).
- **Mobile:** Capacitor (Android).
- **Bundler:** Custom build scripts (`build.ts`, `dev.ts`) using `bun build`.

**Key Constraints:**
- Always use `bun` for package management and script execution.
- `dist/` is the build output directory; do not edit files there manually.
- The project uses ESM modules (`type: "module"` in `package.json`).

## 2. Build, Test, and Execution

### Primary Commands
| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `bun install` | Install dependencies. |
| **Dev (Web)** | `bun run dev` | Hot-reloading server for web/UI development. |
| **Build (Web)** | `bun run build` | Compiles React/TS to `./dist`. |
| **Run (Electron)** | `bun run build && bunx electron electron/main.js` | Fast dev loop for Electron without packaging. |
| **Package (Linux)**| `bun run build && bunx electron-builder` | Builds `.AppImage` in `dist/`. |
| **Android** | `bun run cap:android` | Syncs and opens Android Studio. |

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

### Imports
- **Grouping:** 
  1. React / External Libraries
  2. Local Services / Utils
  3. Components
  4. Styles / Assets
- **Paths:** Use relative imports for now (e.g., `../../services/`).

## 4. Architecture & Services

- **`src/services/`**: Contains core business logic.
  - **`audio/`**: Audio processing logic (duration, conversion, splitting).
  - **`mistral/`**: API clients and interactions.
- **`electron/`**: Electron main process code.
  - **Security:** Keep `nodeIntegration: true` only if strictly necessary (currently enabled). 
  - **IPC:** Use `ipcMain` and `ipcRenderer` for communication if expanding features.

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
