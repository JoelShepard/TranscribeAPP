# TranscribeJS

TranscribeJS is a desktop application for transcribing audio files using Mistral AI, built with React, TypeScript, Bun, and Electron.

## Features
- **Audio Transcription**: Upload or record audio to transcribe.
- **Mistral AI Integration**: Uses Mistral's API for high-quality transcription.
- **Smart Processing**: Automatically splits long audio files (>15 mins) and normalizes audio format.
- **Cross-Platform**: Built with Electron for desktop and Capacitor for mobile (Android support included).

## Build & Run

**Prerequisites:**
- [Bun](https://bun.com) runtime

**Commands:**

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `bun install` | Install dependencies. |
| **Development** | `bun run dev` | Starts the hot-reloading development server for Web. |
| **Build (AppImage)** | `bun run build && bunx electron-builder` | Builds and packages the Linux AppImage. |
| **Run Electron (Dev)** | `bun run build && bunx electron electron/main.js` | Runs the built app in Electron without packaging. |
| **Android Dev** | `bun run cap:android` | Builds web assets, syncs Capacitor, and opens Android Studio. |

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19, TailwindCSS v4
- **Desktop**: Electron
- **Mobile**: Capacitor
- **Audio Processing**: Web Audio API (native browser implementation)

## Project Structure

- `src/`: React source code
  - `services/`: Core logic (Audio processing, API clients)
- `electron/`: Electron main process
- `dist/`: Build output
- `build.ts`: Custom build script
- `dev.ts`: Custom dev server
