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
| **Build (Tauri)** | `bun run build:tauri` | Build Linux native Tauri app.              |
| **Android Sync**  | `bun run cap:sync`    | Build web assets and sync Android project. |
| **Build (Android APK)** | `bun run build:android` | Build APK into `artifacts/android/` (release if signing is configured, otherwise debug). |
| **Run Temp (ADB)** | `bun run build:adb` | Build debug, run on device, then uninstall automatically when stopped. |
| **Android Dev**   | `bun run cap:android` | Sync and open Android Studio project.      |
| **Tests**         | `bun test`            | Run Bun test suite.                        |

To force a signed release APK, provide signing vars:

- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- one of: `ANDROID_KEYSTORE_BASE64` (same secret used in GitHub Actions) or `ANDROID_KEYSTORE_PATH` (defaults to `android/app/release-key.jks`)

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
