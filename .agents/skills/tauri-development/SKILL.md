---
name: tauri-development
description: "Desktop development for TranscribeJS using Tauri v2. Covers Rust backend, CSP configuration, window decorations (TitleBar), and desktop-specific build/release pipelines."
---

# Tauri Desktop Development Skill

This skill provides the authoritative instructions for developing and building the TranscribeJS desktop application using Tauri v2.

## 1. Environment & Architecture
- **Backend:** Rust (`src-tauri/`).
- **Config:** `src-tauri/tauri.conf.json`.
- **Dependencies:** `src-tauri/Cargo.toml`.
- **Window Decorations:** `decorations: false` in config. UI chrome is provided by `src/components/TitleBar.tsx`.

## 2. Critical Rules (Anti-Regression)

### 2.1 Tauri CSP (`connect-src`) Guard
The Content Security Policy in `src-tauri/tauri.conf.json` → `app.security.csp` controls all network access.
- **Rule:** When adding/changing an external API endpoint, add its origin to `connect-src` in the same changeset.
- **Current whitelist:** `https://api.mistral.ai`.
- **Verification:** Run `bun run dev:tauri` and validate the full flow (record -> transcribe -> result).

### 2.2 Custom Window Title Bar
- **Rule:** Never remove or break `TitleBar.tsx` without re-enabling native decorations in `tauri.conf.json`.
- **Failure mode:** Window becomes undraggable and unclosable.

### 2.3 Tauri Capabilities
- **Location:** `src-tauri/capabilities/default.json`.
- **Rule:** New Tauri v2 plugin commands (that aren't custom `invoke_handler` commands) require explicit permissions here.

### 2.4 Header Layout
- **Rule:** The header container in `src/App.tsx` must have `mb-14` (56px) to avoid overlapping with custom window controls in desktop mode.

## 3. Build & Release
- **Dev:** `bun run dev:tauri`
- **Build:** `bun run build:tauri` (Produces optimized binary for Linux).
- **CI:** `release-linux-desktop.yml` uses `ubuntu-22.04` and `--no-bundle`.
