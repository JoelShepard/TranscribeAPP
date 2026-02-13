# Contributing to TranscribeJS

Thanks for contributing to TranscribeJS.

This project targets Bun + React + TypeScript on the frontend, with Tauri for desktop and Capacitor for Android.

## Development Setup

1. Install Bun (v1.3+).
2. Install dependencies:

```bash
bun install
```

3. Start local development:

```bash
bun run dev
```

## Common Commands

- `bun run dev`: Run web development server with hot reload.
- `bun run build`: Build web app into `dist/`.
- `bun run dev:tauri`: Run desktop app in Tauri dev mode.
- `bun run build:tauri`: Build desktop binary.
- `bun run cap:sync`: Build and sync assets to Android project.
- `bun test`: Run test suite.
- `bun run lint`: Run ESLint checks.

## Contribution Workflow

1. Create a feature branch from `main`.
2. Keep changes scoped and focused to one goal.
3. Run validation before opening a PR:
   - `bun run build`
   - `bun test`
   - `bun run lint`
4. Open a pull request with a clear description of what changed and why.

## Coding Guidelines

- Use TypeScript strict-safe code. Avoid `any` unless unavoidable.
- Use functional React components with named exports.
- Prefer reusable hooks for shared logic.
- Use `clsx` + `tailwind-merge` for conditional class composition.
- Keep platform-specific behavior explicit (web, Tauri, Android).
- Do not edit generated build outputs in `dist/`.

## Tauri and Platform Notes

- Linux desktop audio recording uses a native Rust path in Tauri. Do not assume web recording APIs are used in desktop Linux mode.
- The app uses a custom title bar. Do not remove it unless native decorations are re-enabled in Tauri config.
- If adding external API endpoints, update Tauri CSP `connect-src` in `src-tauri/tauri.conf.json`.

## Versioning Rules

When bumping versions, update these four files in the same commit:

- `package.json` (`version`)
- `src-tauri/tauri.conf.json` (`version`)
- `src-tauri/Cargo.toml` (`version` under `[package]`)
- `PKGBUILD` (`pkgver`)

## Milestones

Project progress is tracked in `MILESTONES.md`.

- Work on one unchecked milestone at a time.
- Mark a milestone as done only after code and verification are complete.

## Pull Request Checklist

- [ ] Scope is focused and documented.
- [ ] Build passes (`bun run build`).
- [ ] Tests pass (`bun test`).
- [ ] Lint passes (`bun run lint`).
- [ ] Docs updated when behavior or workflow changes.

Thanks again for helping improve TranscribeJS.
