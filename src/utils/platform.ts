declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function isCapacitorRuntime(): boolean {
  // Check isNativePlatform() rather than mere presence of window.Capacitor:
  // @capacitor/core sets window.Capacitor when bundled, even in Tauri/browser
  // environments, where isNative is false. Using isNativePlatform() ensures
  // this only returns true on actual Android/iOS native builds.
  return (
    typeof window !== "undefined" &&
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );
}

export function isNativeRuntime(): boolean {
  return isTauriRuntime() || isCapacitorRuntime();
}
