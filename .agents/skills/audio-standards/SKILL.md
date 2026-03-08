---
name: audio-standards
description: "Audio recording and processing standards for TranscribeJS. Covers dual recording paths (Native vs Web), browser security headers for SharedArrayBuffer, and audio service architecture."
---

# Audio Processing Standards Skill

This skill provides the authoritative instructions for developing and maintaining the audio recording and processing pipelines of TranscribeJS.

## 1. Dual Recording Path Integrity
The application uses two separate recording paths in `App.tsx` because `MediaRecorder` is unreliable inside Tauri's Linux webview.

| Condition              | Path   | Implementation                                                                                            |
| :--------------------- | :----- | :-------------------------------------------------------------------------------------------------------- |
| `tauriEnv && linuxEnv` | Native | Rust `cpal` via `invoke('start_native_recording')` / `invoke('stop_native_recording')`, returns WAV bytes |
| Everything else        | Web    | `navigator.mediaDevices.getUserMedia()` + `MediaRecorder` API, produces webm/ogg blob                     |

### Critical Rules
- **Rule:** Any change to recording logic must be tested on **both** paths. A fix that works on web may break Tauri native, and vice versa.
- **Rule:** Do not unify the two paths unless both are fully validated.

## 2. Environment Configuration
- **Rule:** The dev server (`dev.ts`) must set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. These are required for `SharedArrayBuffer` and `OfflineAudioContext`.
- **Rule:** Wrap all async audio service calls (API, FS, Processing) in `try/catch`.
- **UI Feedback:** Always reflect audio processing errors in the UI (set `status` to `'error'`).

## 3. Services
- **Location:** `src/services/audio/`.
- **Logic:** Audio duration, conversion, and splitting.
