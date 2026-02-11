export const ERROR_MESSAGES = {
  unknownError: 'Unknown error',
  noErrorDetails: 'No details',
  invalidAudioFile: 'Please drop a valid audio file.',
  nativeMicrophonePrefix: 'Native microphone error',
  recordingNotSupported:
    'Recording is not supported in this environment. Use Upload Audio as fallback.',
  mediaRecorderNotAvailable:
    'MediaRecorder is not available in this environment. Use Upload Audio as fallback.',
  missingApiKey: 'Please set your Mistral API Key first.',
  processingFailed: 'An error occurred during processing',
  invalidApiKey: 'Invalid API Key. Please check your Mistral API Key in settings.',
  clipboardCopyFailed: 'Could not copy to clipboard. Please try again.',
  tauriLinuxPermissionDenied:
    'Browser-level microphone access failed on Linux Tauri. Native recorder should be used automatically; try recording again.',
  microphonePermissionDenied:
    'Microphone permission denied. Enable microphone access for this app in system/browser settings and try again.',
  noMicrophoneDetected: 'No microphone detected. Connect a microphone and try again.',
  microphoneBusy:
    'Microphone is busy or unavailable. Close other apps using it and try again.',
  secureContextRequired:
    'Recording requires a secure context. Start the app with `bun run dev` or `bun run dev:tauri`.',
} as const;

export function formatNativeMicrophoneError(details: string): string {
  return `${ERROR_MESSAGES.nativeMicrophonePrefix}: ${details}`;
}

export function formatMicrophoneAccessError(name: string, details: string): string {
  return `Microphone access error: ${name} (${details})`;
}
