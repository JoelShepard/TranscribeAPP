# TranscribeJS

TranscribeJS is an audio transcription app powered by Mistral AI, built with React, TypeScript, and Bun.

## Features

- Audio transcription from uploaded or recorded audio.
- Mistral API integration for high-quality transcription.
- Smart preprocessing (normalization and long-audio splitting).
- Multi-platform targets: Tauri desktop (preferred), legacy Electron desktop, and Android via Capacitor.

## Build and Run

Prerequisites:

- [Bun](https://bun.com) v1.3+
- (Optional, desktop) Tauri v2 system dependencies for Linux builds

Commands:

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `bun install` | Install dependencies. |
| **Dev (Web)** | `bun run dev` | Start hot-reloading web development server. |
| **Build (Web)** | `bun run build` | Build web assets into `dist/`. |
| **Dev (Tauri)** | `bun run dev:tauri` | Start Tauri dev environment with hot-reload. |
| **Build (Tauri)** | `bun run build:tauri` | Build optimized Tauri desktop app. |
| **Run (Electron, legacy)** | `bun run build && bunx electron electron/main.js` | Run desktop app with legacy Electron entrypoint. |
| **Android Sync** | `bun run cap:sync` | Build and sync assets to Android project. |
| **Android Dev** | `bun run cap:android` | Sync assets and open Android Studio project. |

## Container Publishing (GitHub)

- Docker image publishing is handled by GitHub Actions workflow `.github/workflows/publish-ghcr.yml`.
- The workflow builds and publishes to GHCR only when a tag matching `v*` is pushed.
- Image path format: `ghcr.io/<owner>/<repo>` (lowercased by workflow).
- Authentication uses the built-in `GITHUB_TOKEN` (no personal access token required for the default setup).

## Android APK Release (GitHub)

- APK publishing is handled by `.github/workflows/release-android-apk.yml`.
- The workflow runs when a tag matching `v*` is pushed and uploads a signed APK to the corresponding GitHub Release.
- Required repository secrets:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- Example (Linux) to create `ANDROID_KEYSTORE_BASE64`: `base64 -w 0 android/app/release-key.jks`
- The APK is attached with filename `TranscribeJS-android-vX.Y.Z.apk`, plus a `.sha256` checksum file.
- Tag push flow (example):
  - `git tag -a v0.1.6 -m "Release v0.1.6"`
  - `git push origin v0.1.6`

## Tech Stack

- Runtime: Bun
- Frontend: React 19, TypeScript, TailwindCSS v4
- Desktop: Tauri v2 (primary), Electron (legacy)
- Mobile: Capacitor (Android)

## Project Structure

- `src/`: React application source
  - `src/services/`: audio processing and API service logic
- `src-tauri/`: Tauri backend and configuration
- `electron/`: legacy Electron main process
- `dist/`: build output
- `build.ts`: custom build script
- `dev.ts`: custom dev server script
