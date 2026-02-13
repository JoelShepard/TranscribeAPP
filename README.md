# TranscribeJS

TranscribeJS is an audio transcription app powered by Mistral AI, built with React, TypeScript, and Bun.

## How To Use

1. Open the app (`bun run dev` for web or `bun run dev:tauri` for desktop).
2. Open **Settings** and paste your Mistral API key.
3. Save the key and wait for validation confirmation.
4. Upload an audio file (or drag and drop) or record directly from the microphone.
5. Wait for processing, then review the transcript and export it as `.txt`.

## Supported Targets

- Linux native desktop app with Tauri v2 (Rust backend, native microphone recording on Linux)
- Windows native desktop app with Tauri v2
- Android app via Capacitor
- Web app packaged and served with Docker

## Requirements

- Bun v1.3+
- Rust toolchain (for Tauri)
- Tauri v2 Linux system dependencies
- Android SDK + command-line tools (Android Studio optional for emulator/IDE)
- Docker (for containerized web app)

## Commands

| Action            | Command               | Description                                |
| :---------------- | :-------------------- | :----------------------------------------- |
| **Install**       | `bun install`         | Install dependencies.                      |
| **Dev (Web)**     | `bun run dev`         | Start web dev server with hot reload.      |
| **Build (Web)**   | `bun run build`       | Build web assets into `dist/`.             |
| **Dev (Tauri)**   | `bun run dev:tauri`   | Start Tauri dev environment.               |
| **Build (Tauri)** | `bun run build:tauri` | Build desktop Tauri app (Linux/Windows).   |
| **Android Sync**  | `bun run cap:sync`    | Build web assets and sync Android project. |
| **Run Temp (ADB)** | `bun run build:adb` | Build debug, run on device, then uninstall automatically when stopped. |
| **Tests**         | `bun test`            | Run Bun test suite.                        |

Signed release APK artifacts are produced by the GitHub Actions release workflow on `v*` tags.

`bun run build:adb` uses the debug package id `com.transcribe.app.debug`, so it can run alongside the release app. It uninstalls the debug app when you close it or press `Ctrl+C`.

## Docker Web App

Build and run the web app container:

```bash
docker build -t transcribejs:web .
docker run --rm -p 3000:3000 transcribejs:web
```

The app will be available at `http://localhost:3000`.

## Arch Linux Packaging

Build and install the native package:

```bash
makepkg -si
```

## Project Structure

- `src/`: React app
- `src/services/`: audio processing + Mistral client
- `src-tauri/`: Tauri Rust backend and config
- `android/`: Capacitor Android project
- `dist/`: generated web build output
- `build.ts`: web build script
- `dev.ts`: web dev server
- `Dockerfile`: web app container build
