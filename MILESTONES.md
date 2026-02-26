# TranscribeJS Milestones

Track important project goals here. Mark items as completed only when fully verified.

## DeepL Translation Module

This section tracks the full implementation of the DeepL-powered translation feature, integrated as a self-contained "app within the app" alongside the existing Mistral transcription module.

#### 7.1 — Settings & API Key Infrastructure

- [x] **Settings**: Add a dedicated "DeepL" section to the Settings panel with an API key input field (masked, with show/hide toggle), mirroring the existing Mistral key UX.
- [x] **Settings**: Add a "Free / Pro plan" toggle that switches the base URL between `https://api-free.deepl.com` and `https://api.deepl.com`, since DeepL uses different hostnames per plan.
- [x] **Settings**: Add a "Test connection" button that calls `/v2/usage` to validate the key and show remaining character quota.
- [x] **Security (Tauri)**: Add `https://api.deepl.com` and `https://api-free.deepl.com` to `connect-src` in `src-tauri/tauri.conf.json` (anti-regression §6.2).

#### 7.2 — DeepL Service Layer

- [x] **Service**: Create `src/services/deepl/deepLClient.ts` — a typed fetch-based client for the DeepL REST API (no SDK dependency, consistent with existing Mistral approach).
  - Implements `translateText(texts: string[], targetLang: string, sourceLang?: string, options?): Promise<Translation[]>`
  - Implements `getUsage(): Promise<{ character_count: number; character_limit: number }>`
  - Handles `DeepL-Auth-Key` auth header, Free/Pro endpoint selection, and all documented error codes (400, 403, 429, 456, 500, 529).
- [x] **Service**: Add `formality` support (`default`, `more`, `less`, `prefer_more`, `prefer_less`) as an optional translation parameter.
- [x] **Service**: Add `model_type` support (`quality_optimized`, `latency_optimized`, `prefer_quality_optimized`) as an optional translation parameter.

#### 7.3 — Translation Card UI

- [x] **UI**: Create a new `TranslationCard` component (`src/components/TranslationCard.tsx`) as a self-contained card rendered in `App.tsx` below the existing transcription cards.
- [x] **UI**: The card must include:
  - A text input area (or pipe from transcript output) for source text.
  - A source language selector (`auto-detect` as default, full 100+ language list from the DeepL API).
  - A target language selector (full list with variants: `EN-US`, `EN-GB`, `PT-BR`, `PT-PT`, `ZH-HANS`, `ZH-HANT`, etc.).
  - A "Translate" action button with loading/disabled state during the API call.
  - A read-only output area displaying the translated text with a copy-to-clipboard button.
  - Display of `detected_source_language` when auto-detect is used.
- [x] **UX**: Add an optional "Translate transcript" shortcut — a button in the transcript result area that pre-fills the TranslationCard source with the current transcript text and scrolls to the card.
- [x] **UX**: Show character count and a soft warning when approaching typical free-tier limits (500k chars/month).

#### 7.4 — Advanced Translation Options (Collapsible Panel)

- [x] **UI**: Add a collapsible "Advanced options" section within the TranslationCard exposing:
  - `formality` selector (only enabled for languages that support it; grayed out otherwise).
  - `model_type` selector (`quality_optimized` default, `latency_optimized` option).
  - `preserve_formatting` toggle.
  - `split_sentences` selector (0 / 1 / nonewlines).

#### 7.5 — Post-Transcription Translation Integration

- [x] **Integration**: After a transcription completes successfully (Mistral flow), show a "Translate result" CTA button in the transcript result card.
- [x] **Integration**: Clicking the CTA auto-fills the TranslationCard with the transcript text, selects a sensible default target language (stored in settings), and triggers translation automatically if a DeepL API key is configured.
- [x] **Settings**: Add a "Default translation target language" selector to the DeepL settings section.

#### 7.6 — Usage Quota Display

- [x] **UI**: In the DeepL settings section, show live quota after key validation: `X / Y characters used this billing period`.
- [x] **UX**: Show a non-blocking warning banner inside the TranslationCard if the quota is at ≥90%.

#### 7.7 — Export Integration

- [ ] **Export**: When exporting a transcript (`.txt`, `.srt`, `.vtt` — where applicable), add an option to include the DeepL translation alongside the source text.
- [ ] **Export**: For `.srt`/`.vtt` exports, allow choosing between source-only, translation-only, or bilingual (source + translation on separate subtitle lines).

#### 7.8 — Tests

- [x] **Tests**: Unit tests for `deepLClient.ts` covering happy path, auth error (403), quota exceeded (456), and rate limit (429/529) cases.
- [ ] **Tests**: Unit tests for target/source language list rendering and formality-availability filtering in `TranslationCard`.

#### 7.9 — Anti-Regression & Release Checklist

- [x] **Anti-regression**: Verify §6.2 — both DeepL endpoints are in `connect-src` after CSP update.
- [x] **Anti-regression**: Verify §6.3 — no impact on dual recording paths after UI changes.
- [x] **Anti-regression**: Verify §6.10 — header layout still has `mb-14` after adding new card.
- [ ] **Release**: All milestones 7.1–7.8 completed, `bun test && bun run build` green, PR reviewed and merged before tagging.

---

### 6) Reliability, Quality, and Developer Experience

- [x] **DeepL Reliability**: Fix "Unexpected token '<'" error in production/Capacitor by adding `isCapacitorRuntime` detection and implementing a production server with proxy support.
- [ ] **Tests**: Expand test coverage for `App.tsx` critical flows (upload, record, error states).
- [ ] **Tests**: Add integration tests for transcription request lifecycle and cancellation.
- [ ] **Performance**: Add benchmark suite for audio split/normalize steps with regression thresholds.
- [ ] **Observability**: Add user-visible diagnostics panel with logs and exportable debug report.
- [ ] **Release**: Automate pre-release validation script (version sync, build, tests, artifact checks).
