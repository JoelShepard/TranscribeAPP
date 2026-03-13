---
name: git-workflow
description: "Authoritative Git workflow for TranscribeJS. Covers branch naming, Conventional Commits, local squash merges, and automated version synchronization across multiple files."
---
# TranscribeJS Git Workflow Skill

This skill provides the authoritative, end-to-end Git workflow for the TranscribeJS repository. It covers branch management, commit standards, local squash merges to `main`, and the automated release process.

## 1. Branch Model

**Branch naming convention — mandatory:**

| Prefix | When to use | Example |
| :----- | :---------- | :------ |
| `feat/` | Adding new user-facing functionality | `feat/audio-waveform-visualizer` |
| `fix/` | Correcting a bug (any severity) | `fix/tauri-csp-load-failed` |
| `chore/` | Build scripts, dependencies, tooling, CI config | `chore/update-bun-1.4` |
| `refactor/` | Code restructuring with no behavior change | `refactor/settings-panel-hooks` |
| `docs/` | Documentation-only changes | `docs/update-agents-workflow` |
| `test/` | Adding or fixing tests | `test/audio-duration-edge-cases` |
| `ci/` | GitHub Actions workflow changes | `ci/pin-ubuntu-runner` |
| `perf/` | Performance improvements | `perf/reduce-bundle-size` |
| `release/` | Release preparation | `release/v0.4.0` |

Names must be lowercase, hyphen-separated, and descriptive.

## 2. Feature Branch Lifecycle

Every unit of work follows these steps:

1. **Sync:** Pull latest `main` before branching.
2. **Branch:** `git checkout -b <prefix>/description`.
3. **Commit:** Make small, atomic commits using Conventional Commits format.
4. **Validate:** `bun test && bun run build` must pass before squashing.
5. **Squash locally:** Squash all branch commits into one Conventional Commit on `main`.
   ```bash
   git checkout main
   git merge --squash <prefix>/description
   git commit -m "<type>(<scope>): <description>"
   ```
6. **Push:** `git push origin main`.
7. **Clean up:** Delete the local branch — `git branch -D <prefix>/description`.

## 3. Golden Rules for `main`

- **No Force Push:** Never use `git push --force` on `main`.
- **Stable `main`:** `main` must always be buildable and pass tests.
- **No Pull Requests:** Changes are squash-merged locally and pushed directly to `main`. Do not open PRs.

## 4. Conventional Commits Standard

Format: `<type>(<optional-scope>): <imperative description in lowercase>`

| Type | Description |
| :--- | :---------- |
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, dependencies, tooling |
| `refactor` | Code restructuring |
| `docs` | Documentation changes |
| `test` | Adding/fixing tests |
| `ci` | CI/CD workflow changes |
| `perf` | Performance improvements |

## 5. Release Flow (Automated)

Every release follows these steps exactly:

### Step 1 — Create Release Branch
```bash
git checkout main && git pull origin main && git checkout -b release/vX.Y.Z
```

### Step 2 — Atomic Version Bump
Update all four files in one commit:
- `package.json` (`"version"`)
- `src-tauri/tauri.conf.json` (`"version"`)
- `src-tauri/Cargo.toml` (`version` under `[package]`)
- `PKGBUILD` (`pkgver`)

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml PKGBUILD
git commit -m "chore(release): bump version to X.Y.Z"
```

### Step 3 — Verify Synchronization
```bash
grep -E '"version"' package.json src-tauri/tauri.conf.json && grep '^version' src-tauri/Cargo.toml && grep '^pkgver' PKGBUILD
```

### Step 4 — Final Validation
```bash
bun test && bun run build
```

### Step 5 — Squash, Push, and Tag
1. Squash-merge into `main` and push:
```bash
git checkout main && git pull origin main
git merge --squash release/vX.Y.Z
git commit -m "chore(release): prepare vX.Y.Z"
git push origin main
```
2. Tag and push:
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```
3. Clean up: `git branch -D release/vX.Y.Z`

