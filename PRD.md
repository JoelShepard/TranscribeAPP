# Product Requirements Document (PRD) - TranscribeJS

## 1. Overview
**TranscribeJS** is a cross-platform application (Web, Android, Linux) designed to transcribe audio files and voice recordings into text using Mistral AI's `voxtral` models. It aims to replicate and extend the robustness of the reference Go implementation (`TranscribeQT`) into a pure JavaScript/TypeScript ecosystem.

## 2. Goals & Objectives
- **True Cross-Platform:** A single codebase that deploys to the Web (PWA), Android (APK), and Linux (AppImage/Deb).
- **Client-Side Processing:** Perform heavy audio manipulation (normalization, splitting) directly on the user's device to ensure privacy and reduce server dependency (excluding the Mistral API call itself).
- **Robust Transcription:** Handle long audio files (>15 mins) by automatically splitting them into chunks, mirroring the logic of the reference implementation.
- **User-Friendly:** Simple UI for recording, uploading, and viewing transcriptions.

## 3. Tech Stack
- **Language:** TypeScript.
- **Runtime & Bundler:** Bun (for development, testing, and bundling).
- **Frontend Framework:** React.
- **UI Library:** TailwindCSS.
- **Cross-Platform Engines:**
  - **Android:** Capacitor (wraps the React app).
  - **Linux:** Electron (wraps the React app).
  - **Web:** Standard SPA/PWA.
- **Audio Processing:**
  - **Web/Android:** `ffmpeg.wasm` (runs FFmpeg in the browser/webview via WebAssembly).
  - **Linux:** `ffmpeg.wasm` or native `fluent-ffmpeg` spawning local binaries (configurable).

## 4. Functional Requirements

### 4.1 Audio Input
- **File Upload:** Support for standard audio formats (MP3, WAV, M4A, OGG).
- **Voice Recorder:** Built-in microphone recording capability within the app.

### 4.2 Audio Processing Strategy (Core Logic)
*Reference Implementation: `TranscribeQT/api/audiosplitter.go`*

The application must implement an **Audio Processor Service** that handles:

1.  **Metadata Extraction:** Determine duration and file size.
2.  **Normalization:**
    - Convert input to **16kHz, Mono, MP3/WAV** before sending to API.
    - *Goal:* Maximize compatibility and minimize bandwidth.
3.  **Smart Splitting (Long Files):**
    - **Threshold:** If file duration > **900 seconds (15 minutes)** OR size > **25MB**.
    - **Chunking Logic:** Split into segments of 900s.
    - **Overlap:** Apply a **3-second overlap** between chunks to prevent cutting words at boundaries.
    - *Example:* Chunk 1 (0-900s), Chunk 2 (897s-1797s), etc.

### 4.3 Transcription API Integration
*Reference Implementation: `TranscribeQT/api/mistral.go`*

- **Endpoint:** `POST https://api.mistral.ai/v1/audio/transcriptions`
- **Model:** `voxtral-mini-latest` (default).
- **Authentication:** Bearer Token via `MISTRAL_API_KEY`.
- **Flow:**
    1.  User provides API Key (saved in local storage/secure storage).
    2.  App checks file criteria.
    3.  If split is required, iterate through chunks sequentially or in parallel (concurrency limit: 2).
    4.  Send `multipart/form-data` with `file` and `model`.
    5.  Handle "Mistral Refused" errors (often due to encoding) by re-encoding/retrying.
    6.  Merge results: Concatenate text responses, handling the overlap intelligently (simple concatenation is acceptable for MVP, fuzzy match merging is an enhancement).

### 4.4 User Interface
- **Settings Screen:** Input field for API Key.
- **Main Dashboard:**
    - "Drag & Drop" area for files.
    - "Record" button.
- **Transcription View:**
    - Progress bar (e.g., "Transcribing chunk 2 of 5...").
    - Text editor area to view/edit the result.
    - "Copy to Clipboard" and "Save to File" buttons.

## 5. Non-Functional Requirements
- **Security:** API Keys must never be logged or sent to any server other than Mistral directly.
- **Performance:** Audio processing (ffmpeg) should run in a Web Worker to avoid freezing the UI.
- **Offline Capability:** The app (shell) works offline, though transcription requires internet.

## 6. Project Structure (Proposed)
```
/
├── electron/         # Electron specific main process code
├── android/          # Capacitor android project
├── src/
│   ├── components/   # React UI components
│   ├── services/
│   │   ├── mistral/  # API client
│   │   └── audio/    # ffmpeg.wasm logic
│   └── hooks/
├── package.json
├── capacitor.config.ts
└── bun.lockb
```

## 7. Implementation Roadmap
1.  **Project Scaffold:** Initialize React + Bun + Tailwind.
2.  **Core Audio Engine:** Implement `ffmpeg.wasm` integration and splitting logic.
3.  **API Client:** Implement Mistral client with error handling.
4.  **UI Construction:** Build the visual interface.
5.  **Platform Integration:**
    - Configure Capacitor for Android permissions (Microphone, File System).
    - Configure Electron for Linux build.
