# TranscribeJS Milestones

Track important project goals here. Mark items as completed only when fully verified.

## Completed

- [x] Dark mode implemented.
- [x] Status bar removed from desktop build.
- [x] Repository migrated to GitHub (`JoelShepard/TranscribeAPP`).
- [x] CI workflow migrated from Codeberg registry to GitHub Container Registry (GHCR).
- [x] Automated Docker publish configured with tag-only release trigger (`v*`).
- [x] CI workflow added to run tests (`bun test`) on pull requests.
- [x] Linux native Tauri microphone recording integrated via Rust backend.
- [x] Repository cleaned to supported targets only (Android, Linux Tauri, Docker web app).
- [x] Publish release artifacts (desktop binary) on GitHub Releases.

## Next

- [x] **Tests**: Create `src/services/audio/AudioProcessor.test.ts` and scaffold tests for `getAudioDuration`.
- [x] **Tests**: Implement unit tests for `splitAudio` logic in `AudioProcessor`.
- [x] **Tests**: Implement unit tests for `normalizeAudio` in `AudioProcessor`.
- [x] **Tests**: Create `src/services/mistral/MistralClient.test.ts` with mocked fetch calls.
- [x] **UI**: Add "Drag & Drop" zone to the file upload area in `App.tsx`.
- [x] **UI**: Add a CSS-based audio visualizer (bars or wave) during recording state.
- [x] **Feature**: Implement `HistoryContext` to store transcription metadata in `localStorage`.
- [x] **Feature**: Create a "History" sidebar/modal to list past transcriptions.
- [x] **Feature**: Add "Export to Markdown" button in the result view.
- [x] **Feature**: Add "Export to JSON" button (including metadata like date, duration).
- [x] **Settings**: Add model selection dropdown (e.g., `mistral-tiny`, `mistral-small`) to Settings.
- [x] **Settings**: Add source language input field (optional) for Mistral API.
- [x] **UX**: Implement `Ctrl+Enter` shortcut to save settings.
- [x] **UX**: Implement `Esc` shortcut to close the Settings modal.
- [x] **UX**: Add visual feedback (checkmark) to the "Copy" button when clicked.
- [x] **Refactor**: Extract hardcoded error messages to `src/constants/messages.ts`.
- [x] **Refactor**: Move TypeScript interfaces from `App.tsx` to `src/types/index.ts`.
- [x] **CI**: Add a linting script to `package.json` and a CI step for `bun run lint`.
- [x] **Docs**: Update `README.md` with new screenshots and "How to use" section.
- [x] **Docs**: Create `CONTRIBUTING.md` with development guidelines.
- [x] **Android**: Verify and update adaptive icons for Android build.
- [x] **Android**: Create a branded splash screen for the Android app.
- [ ] **Tauri**: Customize the native window menu (File, Edit, View) or hide it if unnecessary.
- [ ] **Tauri**: Implement a basic system tray icon using Tauri API.
- [ ] **Performance**: Optimize `App.tsx` with `useMemo` for expensive renders.
- [ ] **Error Handling**: implementation of a global React Error Boundary.
- [ ] **Audio**: explicitly test and list supported formats (WAV, MP3, M4A, OGG) in the UI.
- [ ] **Analytics**: Add a simple local counter for "Total Files Transcribed".
- [ ] **Cleanup**: Audit and remove unused imports across `src/`.
- [ ] **Cleanup**: Run a full project formatting pass.
