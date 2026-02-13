import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();
const androidDir = join(rootDir, "android");
const packageId = "com.transcribe.app.debug";
const launchActivity = "com.transcribe.app.MainActivity";
const debugApkPath = join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");

async function runCommand(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${cmd.join(" ")}`);
  }

  return output;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getOnlineDeviceSerial(devicesOutput: string): string {
  const lines = devicesOutput.split("\n").map((line) => line.trim());
  const devices = lines
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === "device");

  if (devices.length === 0) {
    throw new Error("[adb] No online device detected. Connect a phone and enable USB debugging.");
  }

  const firstDevice = devices[0];
  if (!firstDevice || !firstDevice[0]) {
    throw new Error("[adb] Unable to resolve device serial.");
  }

  return firstDevice[0];
}

async function isAppProcessRunning(serial: string): Promise<boolean> {
  const output = await runCommand(["adb", "-s", serial, "shell", "pidof", packageId], rootDir).catch(() => "");
  return output.trim().length > 0;
}

async function cleanupTemporaryInstall(serial: string): Promise<void> {
  await runCommand(["adb", "-s", serial, "shell", "am", "force-stop", packageId], rootDir).catch(() => undefined);
  await runCommand(["adb", "-s", serial, "uninstall", packageId], rootDir).catch(() => undefined);
}

console.log("[adb] Building web assets and syncing Capacitor...");
await runCommand(["bun", "run", "cap:sync"], rootDir);

console.log("[adb] Building debug APK...");
await runCommand(["./gradlew", ":app:assembleDebug"], androidDir);

if (!(await fileExists(debugApkPath))) {
  throw new Error(`[adb] Debug APK not found at ${debugApkPath}`);
}

console.log("[adb] Checking connected devices...");
const devicesOutput = await runCommand(["adb", "devices"], rootDir);
const serial = getOnlineDeviceSerial(devicesOutput);

console.log(`[adb] Deploying temporary build to ${serial}...`);
await cleanupTemporaryInstall(serial);
await runCommand(["adb", "-s", serial, "install", "-r", "-t", debugApkPath], rootDir);
await runCommand(
  ["adb", "-s", serial, "shell", "am", "start", "-n", `${packageId}/${launchActivity}`],
  rootDir,
);

const autoExitSeconds = Number.parseInt(process.env.ADB_AUTO_EXIT_SECONDS ?? "", 10);
const hasAutoExit = Number.isFinite(autoExitSeconds) && autoExitSeconds > 0;

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log("\n[adb] Cleaning up temporary app install...");
  await cleanupTemporaryInstall(serial);
  console.log("[adb] Cleanup complete.");
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

if (hasAutoExit) {
  console.log(`[adb] Auto cleanup in ${autoExitSeconds}s (ADB_AUTO_EXIT_SECONDS).`);
  await Bun.sleep(autoExitSeconds * 1000);
  await shutdown();
  process.exit(0);
}

console.log("[adb] App launched for quick test. Press Ctrl+C to stop and uninstall.");

while (true) {
  await Bun.sleep(1500);
  const running = await isAppProcessRunning(serial);
  if (!running) {
    await shutdown();
    process.exit(0);
  }
}
