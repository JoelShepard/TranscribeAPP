import { constants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();
const androidDir = join(rootDir, "android");
const artifactsDir = join(rootDir, "artifacts", "android");

type PackageJson = {
  version?: string;
};

async function runCommand(cmd: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${cmd.join(" ")}`);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveKeystorePath(androidAppDir: string): Promise<{ path: string; temporary: boolean } | null> {
  const configuredPath = process.env.ANDROID_KEYSTORE_PATH?.trim();
  const defaultKeystorePath = join(androidAppDir, "release-key.jks");
  const finalPath = configuredPath
    ? (configuredPath.startsWith("/") ? configuredPath : join(androidAppDir, configuredPath))
    : defaultKeystorePath;

  const keystoreBase64 = process.env.ANDROID_KEYSTORE_BASE64?.trim();
  if (keystoreBase64) {
    const data = Buffer.from(keystoreBase64, "base64");
    if (data.length === 0) {
      throw new Error("[android] ANDROID_KEYSTORE_BASE64 is not a valid keystore payload.");
    }

    await Bun.write(finalPath, data);
    console.log(`[android] Keystore restored from ANDROID_KEYSTORE_BASE64 to ${finalPath}`);
    return { path: finalPath, temporary: true };
  }

  if (await fileExists(finalPath)) {
    return { path: finalPath, temporary: false };
  }

  return null;
}

console.log("[android] Building web assets and syncing Capacitor...");
await runCommand(["bun", "run", "cap:sync"], rootDir);

const packageJson = (await Bun.file(join(rootDir, "package.json")).json()) as PackageJson;
const appVersionName = process.env.APP_VERSION_NAME ?? packageJson.version ?? "0.0.0";
const appVersionCode = process.env.APP_VERSION_CODE ?? `${Math.floor(Date.now() / 1000)}`;

const androidAppDir = join(androidDir, "app");
const keystore = await resolveKeystorePath(androidAppDir);
const keystorePassword = process.env.ANDROID_KEYSTORE_PASSWORD?.trim();
const keyAlias = process.env.ANDROID_KEY_ALIAS?.trim();
const keyPassword = process.env.ANDROID_KEY_PASSWORD?.trim();
const hasReleaseCredentials = Boolean(keystore && keystorePassword && keyAlias && keyPassword);
const gradleTask = hasReleaseCredentials ? ":app:assembleRelease" : ":app:assembleDebug";

console.log(`[android] Running Gradle task ${gradleTask}...`);

const gradleArgs = [
  "./gradlew",
  gradleTask,
  `-PAPP_VERSION_NAME=${appVersionName}`,
  `-PAPP_VERSION_CODE=${appVersionCode}`,
];

if (hasReleaseCredentials && keystore && keystorePassword && keyAlias && keyPassword) {
  gradleArgs.push(`-PTRANSCRIBE_KEYSTORE_PATH=${keystore.path}`);
  gradleArgs.push(`-PTRANSCRIBE_KEYSTORE_PASSWORD=${keystorePassword}`);
  gradleArgs.push(`-PTRANSCRIBE_KEY_ALIAS=${keyAlias}`);
  gradleArgs.push(`-PTRANSCRIBE_KEY_PASSWORD=${keyPassword}`);
} else {
  console.log("[android] Release signing not configured, generating debug-signed APK.");
}

await runCommand(gradleArgs, androidDir);

const buildKind = hasReleaseCredentials ? "release" : "debug";
const apkRelativePath = hasReleaseCredentials
  ? join("app", "build", "outputs", "apk", "release", "app-release.apk")
  : join("app", "build", "outputs", "apk", "debug", "app-debug.apk");
const sourceApk = join(androidDir, apkRelativePath);

if (!(await fileExists(sourceApk))) {
  throw new Error(`[android] APK not found at ${sourceApk}`);
}

await mkdir(artifactsDir, { recursive: true });
const outputApk = join(artifactsDir, `TranscribeJS-android-v${appVersionName}-${buildKind}.apk`);

await cp(sourceApk, outputApk, { force: true });

if (keystore?.temporary) {
  await rm(keystore.path, { force: true });
  console.log(`[android] Temporary keystore removed: ${keystore.path}`);
}

console.log(`[android] APK generated: ${outputApk}`);
