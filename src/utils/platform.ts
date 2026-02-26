declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function isCapacitorRuntime(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).Capacitor);
}

export function isNativeRuntime(): boolean {
  return isTauriRuntime() || isCapacitorRuntime();
}
