---
name: git-workflow
description: "Authoritative Git workflow for TranscribeJS. Covers branch naming, Conventional Commits, PR procedures, and automated version synchronization across multiple files."
---
# TranscribeJS Git Workflow Skill

This skill provides the authoritative, end-to-end Git workflow for the TranscribeJS repository. It covers branch management, commit standards, Pull Request procedures, and the automated release process.

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
4. **Validate:** `bun test && bun run build` must pass before pushing.
5. **Push & PR:** Open a PR using the checklist template.
6. **Squash merge:** Use `gh pr merge <PR> --squash --delete-branch`.
7. **Clean up:** Delete local branch and pull updated `main`.

## 3. Golden Rules for `main`

- **No Direct Pushes:** Never push directly to `main` for source changes.
- **Stable `main`:** `main` must always be buildable and pass tests.
- **Review Required:** All changes land on `main` via reviewed Pull Requests.
- **No Force Push:** Never use `git push --force` on `main`.

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

### Step 5 — PR and Tag
1. Push branch: `git push -u origin release/vX.Y.Z`
2. Create PR: `gh pr create --title "chore(release): prepare vX.Y.Z" --body "Release vX.Y.Z"`
3. After merge, tag and push:
```bash
git checkout main && git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

## 6. Pull Request Checklist Template

```markdown
## Description
<!-- One paragraph explaining what this PR does and why. -->

## Type of change
- [ ] `feat` | [ ] `fix` | [ ] `chore` | [ ] `refactor` | [ ] `ci` | [ ] `docs` | [ ] `perf` | [ ] `test`

## Local validation
- [ ] `bun test` passes
- [ ] `bun run build` completes

## Anti-regression checks
- [ ] §6.1 — Version sync (if applicable)
- [ ] §6.2 — Tauri CSP Guard
- [ ] §6.3 — Dual Recording Path
- [ ] §6.4 — TitleBar Integrity
- [ ] §6.6 — Build Pipeline (Tailwind)
- [ ] §6.10 — Header Layout Margin
```
