---
name: mobile-android
description: "Android development for TranscribeJS using Capacitor. Covers Android SDK requirements, Capacitor sync workflows, Gradle configuration, and CI/CD signing secrets."
---

# Mobile Android Development Skill

This skill provides the authoritative instructions for developing and building the TranscribeJS mobile application for Android using Capacitor.

## 1. Environment & Architecture
- **Runtime:** Java 21.
- **SDK:** `minSdkVersion` (24), `compileSdkVersion` (36), `targetSdkVersion` (36).
- **Configuration:** `variables.gradle`.

## 2. Development Workflow

### 2.1 Capacitor Sync
- **Rule:** `bun run cap:sync` MUST be run before any Android build.
- **Purpose:** Copies `dist/` into `android/app/src/main/assets/public/`.

## 3. Build & Release
- **Command:** `bun run cap:sync` then build APK with Android Studio or Gradle.
- **CI Workflow:** `release-android-apk.yml`.
- **Signing Secrets:**
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

## 4. Verification
- After syncing assets, always verify the public directory contains the latest build from `dist/`.
