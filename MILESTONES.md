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

## New Roadmap

### 1) Transcription Intelligence

- [ ] **Feature**: Add optional word/sentence timestamps to transcript output and exports.
- [ ] **Feature**: Add speaker diarization support (Speaker 1, Speaker 2) with editable labels.
- [ ] **Feature**: Add confidence scoring and highlight low-confidence transcript segments.
- [ ] **Feature**: Add automatic language detection with manual override fallback.
- [ ] **Feature**: Add post-transcription translation mode (source -> target language).

### 2) Editing and Export Workflow

- [ ] **Editor**: Create an in-app transcript editor with undo/redo and autosave.
- [ ] **Editor**: Add search/replace and quick navigation across long transcripts.
- [ ] **Export**: Add subtitle exports (`.srt` and `.vtt`) with configurable line length/timing.
- [ ] **Export**: Add import/export of full project bundles (audio + transcript + metadata).
- [ ] **UX**: Add transcript sections/chapters and one-click copy per section.

### 3) Audio Processing and Recording

- [ ] **Audio**: Add optional noise reduction and level normalization pre-processing.
- [ ] **Audio**: Add silence trimming and "remove filler pauses" options.
- [ ] **Recording**: Add pause/resume during recording for both web and Tauri Linux paths.
- [ ] **Recording**: Add recording quality presets (low/medium/high) with bitrate visibility.
- [ ] **Queue**: Add batch transcription queue for multiple uploaded files.

### 4) History, Search, and Data Management

- [ ] **History**: Add tags, favorites, and folders to organize transcript history.
- [ ] **History**: Add full-text search across past transcripts with filters by date/model/language.
- [ ] **Data**: Add retention policy settings (auto-delete old items after N days).
- [ ] **Data**: Add secure export/backup and restore flow for local history.
- [ ] **Data**: Add optional encrypted local storage mode for API key and saved transcripts.

### 5) Platform and Product Expansion

- [ ] **Desktop**: Add system-level global shortcut to start/stop recording in Tauri app.
- [ ] **Mobile**: Improve Android recording UX with background-safe interruption handling.
- [ ] **Web**: Add PWA installability with offline-safe UI shell and retry queue.
- [ ] **Accessibility**: Complete keyboard navigation and screen reader audit for all main flows.
- [ ] **Localization**: Introduce i18n framework and ship Italian + English UI locales.

### 6) Reliability, Quality, and Developer Experience

- [ ] **Tests**: Expand test coverage for `App.tsx` critical flows (upload, record, error states).
- [ ] **Tests**: Add integration tests for transcription request lifecycle and cancellation.
- [ ] **Performance**: Add benchmark suite for audio split/normalize steps with regression thresholds.
- [ ] **Observability**: Add user-visible diagnostics panel with logs and exportable debug report.
- [ ] **Release**: Automate pre-release validation script (version sync, build, tests, artifact checks).
