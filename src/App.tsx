import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Mic,
  FileAudio,
  Settings,
  Save,
  Copy,
  Check,
  Loader2,
  StopCircle,
  Sun,
  Moon,
  AudioLines,
  ExternalLink,
  CheckCircle2,
  Languages,
  Eye,
  EyeOff,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { invoke } from "@tauri-apps/api/core";
import { audioProcessor } from "./services/audio/AudioProcessor";
import { MistralClient } from "./services/mistral/MistralClient";
import {
  DeepLClient,
  type DeepLPlan,
  type DeepLUsage,
} from "./services/deepl/deepLClient";
import { useTheme } from "./context/ThemeContext";
import { TitleBar } from "./components/TitleBar";
import { TranslationCard } from "./components/TranslationCard";
import { isTauriRuntime } from "./utils/platform";
import {
  ERROR_MESSAGES,
  formatMicrophoneAccessError,
  formatNativeMicrophoneError,
} from "./constants/messages";
import {
  type Status,
} from "./types";
import {
  AUDIO_FILE_INPUT_ACCEPT,
  isSupportedAudioFile,
  SUPPORTED_AUDIO_FORMATS_LABEL,
} from "./utils/audioFormats";
import pkg from "../package.json";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function isLinuxPlatform(): boolean {
  return typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent);
}

function getRecordingErrorMessage(
  err: unknown,
  context: { tauriEnv: boolean; linuxEnv: boolean },
): string {
  const name = (err as any)?.name;
  const message = (err as any)?.message;
  const isLinuxTauri = context.tauriEnv && context.linuxEnv;

  if (
    name === "NotAllowedError" ||
    message?.toLowerCase().includes("permission denied")
  ) {
    if (isLinuxTauri) {
      return ERROR_MESSAGES.tauriLinuxPermissionDenied;
    }

    return ERROR_MESSAGES.microphonePermissionDenied;
  }
  if (name === "NotFoundError") {
    return ERROR_MESSAGES.noMicrophoneDetected;
  }
  if (name === "NotReadableError") {
    return ERROR_MESSAGES.microphoneBusy;
  }
  if (name === "SecurityError") {
    return ERROR_MESSAGES.secureContextRequired;
  }

  return formatMicrophoneAccessError(
    name || ERROR_MESSAGES.unknownError,
    message || ERROR_MESSAGES.noErrorDetails,
  );
}

function getErrorDetails(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object") {
    const maybeMessage = (err as any).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(err);
    } catch {
      return ERROR_MESSAGES.unknownError;
    }
  }

  return ERROR_MESSAGES.unknownError;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // ── Mistral ─────────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyVerified, setIsApiKeyVerified] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  // ── DeepL ────────────────────────────────────────────────────────────────
  const [deepLApiKey, setDeepLApiKey] = useState("");
  const [deepLPlan, setDeepLPlan] = useState<DeepLPlan>("free");
  const [deepLDefaultTargetLang, setDeepLDefaultTargetLang] = useState("EN-US");
  const [isDeepLKeyVerified, setIsDeepLKeyVerified] = useState(false);
  const [isTestingDeepL, setIsTestingDeepL] = useState(false);
  const [deepLUsage, setDeepLUsage] = useState<DeepLUsage | null>(null);
  const [deepLTestError, setDeepLTestError] = useState("");
  const [showDeepLKey, setShowDeepLKey] = useState(false);
  const [showMistralKey, setShowMistralKey] = useState(false);
  // Text to pre-fill in TranslationCard (set when user clicks "Translate result")
  const [translationInitialText, setTranslationInitialText] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState("");
  const [tauriEnv, setTauriEnv] = useState(() => isTauriRuntime());
  const [linuxEnv, setLinuxEnv] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaMimeTypeRef = useRef("audio/webm");
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translationCardRef = useRef<HTMLDivElement | null>(null);

  const visualizerBars = useMemo(
    () => Array.from({ length: 8 }, (_, index) => index),
    [],
  );
  const hasVerifiedApiKey = isApiKeyVerified;

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    setTauriEnv(isTauriRuntime());
    setLinuxEnv(isLinuxPlatform());

    const storedMistralKey = localStorage.getItem("mistral_api_key");
    const storedMistralVerified =
      localStorage.getItem("mistral_api_key_verified") === "true";
    if (storedMistralKey) {
      setApiKey(storedMistralKey);
      setIsApiKeyVerified(storedMistralVerified);
    }

    const storedDeepLKey = localStorage.getItem("deepl_api_key");
    const storedDeepLPlan =
      (localStorage.getItem("deepl_plan") as DeepLPlan) ?? "free";
    const storedDeepLTarget =
      localStorage.getItem("deepl_default_target_lang") ?? "EN-US";
    const storedDeepLVerified =
      localStorage.getItem("deepl_api_key_verified") === "true";
    if (storedDeepLKey) {
      setDeepLApiKey(storedDeepLKey);
      setIsDeepLKeyVerified(storedDeepLVerified);
    }
    setDeepLPlan(storedDeepLPlan);
    setDeepLDefaultTargetLang(storedDeepLTarget);
  }, []);

  // ── Mistral settings ─────────────────────────────────────────────────────
  const saveSettings = async () => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError("Please enter a Mistral API Key before saving.");
      return;
    }

    try {
      setError("");
      setIsSavingApiKey(true);
      const client = new MistralClient(trimmedApiKey);
      await client.validateApiKey();

      localStorage.setItem("mistral_api_key", trimmedApiKey);
      localStorage.setItem("mistral_api_key_verified", "true");
      setApiKey(trimmedApiKey);
      setIsApiKeyVerified(true);
    } catch (err: unknown) {
      console.error("[App] API key validation failed:", err);
      localStorage.removeItem("mistral_api_key_verified");
      setIsApiKeyVerified(false);
      setError("Invalid API Key. Please check it and try again.");
      setShowSettings(true);
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (isApiKeyVerified) {
      setIsApiKeyVerified(false);
      localStorage.removeItem("mistral_api_key_verified");
    }
  };

  // ── DeepL settings ───────────────────────────────────────────────────────
  const handleDeepLKeyChange = (value: string) => {
    setDeepLApiKey(value);
    if (isDeepLKeyVerified) {
      setIsDeepLKeyVerified(false);
      localStorage.removeItem("deepl_api_key_verified");
    }
    setDeepLTestError("");
  };

  const saveDeepLSettings = () => {
    const trimmed = deepLApiKey.trim();
    localStorage.setItem("deepl_api_key", trimmed);
    localStorage.setItem("deepl_plan", deepLPlan);
    localStorage.setItem("deepl_default_target_lang", deepLDefaultTargetLang);
  };

  const testDeepLConnection = async () => {
    const trimmedKey = deepLApiKey.trim();
    if (!trimmedKey) {
      setDeepLTestError("Please enter a DeepL API key.");
      return;
    }

    setDeepLTestError("");
    setIsTestingDeepL(true);
    setDeepLUsage(null);

    try {
      const client = new DeepLClient(trimmedKey, deepLPlan);
      const usage = await client.getUsage();
      setDeepLUsage(usage);
      setIsDeepLKeyVerified(true);
      localStorage.setItem("deepl_api_key", trimmedKey);
      localStorage.setItem("deepl_plan", deepLPlan);
      localStorage.setItem("deepl_default_target_lang", deepLDefaultTargetLang);
      localStorage.setItem("deepl_api_key_verified", "true");
      setDeepLApiKey(trimmedKey);
    } catch (err: unknown) {
      console.error("[App] DeepL connection test failed:", err);
      localStorage.removeItem("deepl_api_key_verified");
      setIsDeepLKeyVerified(false);
      const msg =
        err instanceof Error ? err.message : "Connection test failed.";
      setDeepLTestError(msg);
    } finally {
      setIsTestingDeepL(false);
    }
  };

  // ── Settings keyboard handling ───────────────────────────────────────────
  const handleSettingsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowSettings(false);
      return;
    }

    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      void saveSettings();
    }
  };

  // ── Audio handling ───────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!isSupportedAudioFile(file)) {
      setError(ERROR_MESSAGES.invalidAudioFile);
      setStatus("error");
      return;
    }

    await processAudio(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!isSupportedAudioFile(file)) {
      setError(ERROR_MESSAGES.invalidAudioFile);
      setStatus("error");
      return;
    }

    await processAudio(file);
  };

  const startRecording = async () => {
    const useNativeRecorder = tauriEnv && linuxEnv;

    if (useNativeRecorder) {
      try {
        setError("");
        console.log("[App] Starting native microphone recording...");
        await invoke("start_native_recording");
        setStatus("recording");
      } catch (err: unknown) {
        console.error("[App] Error starting native recording:", err);
        setError(formatNativeMicrophoneError(getErrorDetails(err)));
        setStatus("error");
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(ERROR_MESSAGES.recordingNotSupported);
      setStatus("error");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError(ERROR_MESSAGES.mediaRecorderNotAvailable);
      setStatus("error");
      return;
    }

    try {
      console.log("[App] Requesting microphone access...");
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(
        "[App] Available devices:",
        devices.map((d) => `${d.kind}: ${d.label}`),
      );

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[App] Microphone access granted");
      mediaStreamRef.current = stream;

      const mimeTypeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const selectedMimeType = mimeTypeCandidates.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      mediaMimeTypeRef.current = selectedMimeType ?? "audio/webm";
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaMimeTypeRef.current;
        let extension = "webm";
        if (mimeType.includes("ogg")) {
          extension = "ogg";
        } else if (mimeType.includes("mp4")) {
          extension = "mp4";
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording.${extension}`, {
          type: mimeType,
        });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        await processAudio(file);
      };

      mediaRecorder.start();
      setStatus("recording");
    } catch (err: unknown) {
      console.error("[App] Error starting recording:", err);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setError(getRecordingErrorMessage(err, { tauriEnv, linuxEnv }));
      setStatus("error");
    }
  };

  const stopRecording = async () => {
    if (status !== "recording") {
      return;
    }

    const useNativeRecorder = tauriEnv && linuxEnv;
    if (useNativeRecorder) {
      try {
        setStatus("processing");
        setProgress("Finalizing native recording...");
        const audioBytes = await invoke<number[]>("stop_native_recording");
        const audioData = Uint8Array.from(audioBytes);
        const file = new File([audioData], "recording.wav", {
          type: "audio/wav",
        });
        await processAudio(file);
      } catch (err: unknown) {
        console.error("[App] Error stopping native recording:", err);
        setError(formatNativeMicrophoneError(getErrorDetails(err)));
        setProgress("");
        setStatus("error");
      }
      return;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      if (isTauriRuntime() && isLinuxPlatform()) {
        void invoke("stop_native_recording").catch(() => {
          // Ignore cleanup errors.
        });
      }
    };
  }, []);

  const processAudio = async (file: File) => {
    console.log(
      "[App] Starting processAudio for file:",
      file.name,
      "size:",
      file.size,
      "type:",
      file.type,
    );

    if (!apiKey) {
      console.error("[App] No API key set");
      setError(ERROR_MESSAGES.missingApiKey);
      setIsApiKeyVerified(false);
      setShowSettings(true);
      return;
    }

    try {
      setError("");
      setTranscription("");
      setStatus("processing");
      setProgress("Analyzing audio...");

      console.log("[App] Getting audio duration...");

      const duration = await audioProcessor.getAudioDuration(file);
      console.log(`[App] Audio Duration: ${duration}s`);

      const client = new MistralClient(apiKey);
      let results: string[] = [];

      if (duration > 900) {
        console.log("[App] File exceeds 15 minutes, splitting...");
        setProgress("Splitting long audio file...");
        const chunks = await audioProcessor.splitAudio(file);
        console.log(`[App] Split into ${chunks.length} chunks`);

        setStatus("transcribing");
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[App] Transcribing chunk ${i + 1}/${chunks.length}...`);
          setProgress(`Transcribing chunk ${i + 1} of ${chunks.length}...`);
          const text = await client.transcribe(chunks[i]!);
          console.log(
            `[App] Chunk ${i + 1} transcribed, length: ${text.length} chars`,
          );
          results.push(text);
        }
      } else {
        console.log("[App] File under 15 minutes, normalizing...");
        setProgress("Normalizing audio...");
        const normalizedBlob = await audioProcessor.normalizeAudio(file);
        console.log("[App] Normalized blob size:", normalizedBlob.size);

        setStatus("transcribing");
        setProgress("Sending to Mistral AI...");
        console.log("[App] Sending to Mistral API...");
        const text = await client.transcribe(normalizedBlob);
        console.log(
          "[App] Transcription received, length:",
          text.length,
          "chars",
        );
        results.push(text);
      }

      const fullTranscription = results.join(" ");
      console.log(
        "[App] Full transcription length:",
        fullTranscription.length,
        "chars",
      );
      setTranscription(fullTranscription);
      setStatus("done");
      setProgress("");
      // Reset translation pre-fill when a new transcription arrives
      setTranslationInitialText("");
      console.log("[App] Process complete ✓");
    } catch (err: any) {
      console.error("[App] Error during processing:", err);
      console.error("[App] Error stack:", err.stack);

      let errorMessage = err.message || ERROR_MESSAGES.processingFailed;

      if (
        errorMessage.includes("401") ||
        errorMessage.toLowerCase().includes("unauthorized")
      ) {
        errorMessage = ERROR_MESSAGES.invalidApiKey;
        setIsApiKeyVerified(false);
        localStorage.removeItem("mistral_api_key_verified");
        setShowSettings(true);
      }

      setError(errorMessage);
      setStatus("error");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcription);
      setIsCopied(true);

      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }

      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 1500);
    } catch (err: unknown) {
      console.error("[App] Error copying transcription to clipboard:", err);
      setError(ERROR_MESSAGES.clipboardCopyFailed);
    }
  };

  const downloadText = () => {
    const blob = new Blob([transcription], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcription.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── "Translate result" CTA ───────────────────────────────────────────────
  const handleTranslateResult = useCallback(() => {
    setTranslationInitialText(transcription);
    // Scroll to translation card after React renders
    requestAnimationFrame(() => {
      translationCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [transcription]);

  const deepLKeyConfigured = deepLApiKey.trim().length > 0;

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200 relative overflow-x-hidden",
        tauriEnv && "pt-8",
      )}
    >
      <div className="pointer-events-none absolute top-16 -left-10 h-56 w-56 rounded-full bg-[var(--md-sys-color-primary-container)]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 right-0 h-64 w-64 rounded-full bg-[var(--md-sys-color-secondary-container)]/15 blur-3xl" />
      <TitleBar />
      {/* Header */}
      <header
        className={cn(
          "sticky z-10 transition-colors duration-200 mb-14",
          tauriEnv ? "top-8" : "top-0 pt-[env(safe-area-inset-top)]",
        )}
      >
        <div
          className={cn("max-w-4xl mx-auto px-4 sm:px-6", tauriEnv ? "py-2" : "py-4")}
        >
          {(() => {
            const logoContent = (
              <button
                onClick={() => {
                  setStatus("idle");
                  setTranscription("");
                  setError("");
                  setTranslationInitialText("");
                }}
                className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                aria-label="Go to Home"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] shadow-[0_8px_18px_rgba(39,80,196,0.30)]">
                  <AudioLines className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
                  TranscribeJS
                </h1>
              </button>
            );

            const actionsContent = (
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface-variant)]"
                  aria-label="Toggle theme"
                >
                  {theme === "light" ? (
                    <Moon className="w-6 h-6" />
                  ) : (
                    <Sun className="w-6 h-6" />
                  )}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-2.5 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:opacity-90 transition-colors",
                    showSettings &&
                      "shadow-[0_0_0_2px_color-mix(in_oklab,var(--md-sys-color-primary)_35%,transparent)]",
                  )}
                  aria-label="Settings"
                >
                  <Settings
                    className={cn(
                      "w-6 h-6 transition-transform duration-200",
                      showSettings && "rotate-90",
                    )}
                  />
                </button>
              </div>
            );

            const pillClass =
              "rounded-[28px] border border-[color:var(--md-sys-color-outline)]/20 bg-[var(--md-sys-color-surface-container)]/90 backdrop-blur-sm px-5 shadow-[0_4px_16px_rgba(22,27,45,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.20)]";
            const paddingClass = tauriEnv ? "py-2" : "py-4";

            return (
              <div
                className={cn(
                  "flex gap-3",
                  pillClass,
                  paddingClass,
                  "items-center justify-between",
                )}
              >
                {logoContent}
                {actionsContent}
              </div>
            );
          })()}

          {showSettings && (
            <div
              onKeyDown={handleSettingsKeyDown}
              className="mt-3 rounded-[30px] border border-[color:var(--md-sys-color-outline)]/30 bg-[var(--md-sys-color-surface-container)] p-6 animate-in slide-in-from-top-2 shadow-[0_8px_28px_rgba(22,27,45,0.10)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
            >
              <div className="max-w-2xl mx-auto space-y-8">
                {/* ── Mistral section ── */}
                <div>
                  <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--md-sys-color-primary)] flex items-center justify-center">
                      <AudioLines className="w-3.5 h-3.5 text-[var(--md-sys-color-on-primary)]" />
                    </span>
                    Mistral API
                  </h2>
                  <label className="block text-sm font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
                    API Key
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="relative min-w-0">
                      <input
                        type={showMistralKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder="Enter your Mistral API Key"
                        className="w-full p-3.5 pr-20 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowMistralKey((v) => !v)}
                          className="p-1 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                          aria-label={showMistralKey ? "Hide key" : "Show key"}
                        >
                          {showMistralKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        {isSavingApiKey && (
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--md-sys-color-on-surface-variant)]" />
                        )}
                        {!isSavingApiKey && isApiKeyVerified && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void saveSettings()}
                      disabled={isSavingApiKey}
                      className="shrink-0 min-w-[9.25rem] bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] px-7 py-3 rounded-2xl hover:opacity-90 font-bold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingApiKey ? "Checking..." : "Save"}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-2">
                    Key is stored locally on your device.
                  </p>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-[color:var(--md-sys-color-outline)]/20" />

                {/* ── DeepL section ── */}
                <div>
                  <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--md-sys-color-tertiary)] flex items-center justify-center">
                      <Languages className="w-3.5 h-3.5 text-[var(--md-sys-color-on-tertiary)]" />
                    </span>
                    DeepL Translation
                  </h2>

                  {/* Plan toggle */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
                      Plan
                    </label>
                    <div className="flex rounded-2xl overflow-hidden border border-[color:var(--md-sys-color-outline)]/40 w-fit">
                      {(["free", "pro"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setDeepLPlan(p);
                            setIsDeepLKeyVerified(false);
                            setDeepLUsage(null);
                            localStorage.removeItem("deepl_api_key_verified");
                          }}
                          className={cn(
                            "px-6 py-2.5 text-sm font-bold transition-colors capitalize",
                            deepLPlan === p
                              ? "bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]"
                              : "bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                      Free plan uses{" "}
                      <code className="font-mono">api-free.deepl.com</code>;
                      Pro uses <code className="font-mono">api.deepl.com</code>.
                    </p>
                  </div>

                  {/* API Key */}
                  <label className="block text-sm font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
                    API Key
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="relative min-w-0">
                      <input
                        type={showDeepLKey ? "text" : "password"}
                        value={deepLApiKey}
                        onChange={(e) => handleDeepLKeyChange(e.target.value)}
                        placeholder="Enter your DeepL API Key"
                        className="w-full p-3.5 pr-20 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-tertiary)]/50 outline-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowDeepLKey((v) => !v)}
                          className="p-1 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                          aria-label={showDeepLKey ? "Hide key" : "Show key"}
                        >
                          {showDeepLKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        {isTestingDeepL && (
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--md-sys-color-on-surface-variant)]" />
                        )}
                        {!isTestingDeepL && isDeepLKeyVerified && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void testDeepLConnection()}
                      disabled={isTestingDeepL}
                      className="shrink-0 min-w-[9.25rem] bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)] px-7 py-3 rounded-2xl hover:opacity-90 font-bold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isTestingDeepL ? "Testing..." : "Test connection"}
                    </button>
                  </div>
                  {deepLTestError && (
                    <p className="text-xs text-[var(--md-sys-color-error)] mt-2">
                      {deepLTestError}
                    </p>
                  )}
                  {deepLUsage && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
                      {deepLUsage.character_count.toLocaleString()} /{" "}
                      {deepLUsage.character_limit.toLocaleString()} characters
                      used this billing period.
                    </p>
                  )}

                  {/* Default target language */}
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
                      Default translation target language
                    </label>
                    <select
                      value={deepLDefaultTargetLang}
                      onChange={(e) => {
                        setDeepLDefaultTargetLang(e.target.value);
                        localStorage.setItem(
                          "deepl_default_target_lang",
                          e.target.value,
                        );
                      }}
                      className="w-full sm:w-72 p-3 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-tertiary)]/50 outline-none text-sm"
                    >
                      {[
                        { code: "AR", name: "Arabic" },
                        { code: "BG", name: "Bulgarian" },
                        { code: "CS", name: "Czech" },
                        { code: "DA", name: "Danish" },
                        { code: "DE", name: "German" },
                        { code: "EL", name: "Greek" },
                        { code: "EN-GB", name: "English (British)" },
                        { code: "EN-US", name: "English (American)" },
                        { code: "ES", name: "Spanish" },
                        { code: "ET", name: "Estonian" },
                        { code: "FI", name: "Finnish" },
                        { code: "FR", name: "French" },
                        { code: "HU", name: "Hungarian" },
                        { code: "ID", name: "Indonesian" },
                        { code: "IT", name: "Italian" },
                        { code: "JA", name: "Japanese" },
                        { code: "KO", name: "Korean" },
                        { code: "LT", name: "Lithuanian" },
                        { code: "LV", name: "Latvian" },
                        { code: "NB", name: "Norwegian (Bokmål)" },
                        { code: "NL", name: "Dutch" },
                        { code: "PL", name: "Polish" },
                        { code: "PT-BR", name: "Portuguese (Brazilian)" },
                        { code: "PT-PT", name: "Portuguese (European)" },
                        { code: "RO", name: "Romanian" },
                        { code: "RU", name: "Russian" },
                        { code: "SK", name: "Slovak" },
                        { code: "SL", name: "Slovenian" },
                        { code: "SV", name: "Swedish" },
                        { code: "TR", name: "Turkish" },
                        { code: "UK", name: "Ukrainian" },
                        { code: "ZH-HANS", name: "Chinese (Simplified)" },
                        { code: "ZH-HANT", name: "Chinese (Traditional)" },
                      ].map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-3">
                    Key is stored locally on your device.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {!hasVerifiedApiKey && (
        <div
          className={cn(
            "relative z-[1] mb-6 flex justify-center px-4 sm:px-6",
            tauriEnv ? "mt-2" : "-mt-8",
          )}
        >
          <a
            href="https://console.mistral.ai/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--md-sys-color-outline)]/30 bg-[var(--md-sys-color-secondary-container)] px-5 py-3 text-sm font-bold text-[var(--md-sys-color-on-secondary-container)] shadow-[0_10px_24px_rgba(22,27,45,0.16)] hover:-translate-y-0.5 hover:opacity-95 transition-all"
          >
            <span>Get your Mistral API Key</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      <main className="relative flex-1 w-full max-w-4xl mx-auto px-6 pb-6 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-4 rounded-2xl border border-red-300/40 flex items-center gap-2 shadow-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* Input Area */}
        {status === "idle" || status === "error" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "group bg-[var(--md-sys-color-surface-container)] p-8 rounded-[28px] shadow-[0_4px_18px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(39,80,196,0.22)] transition-all cursor-pointer flex flex-col items-center justify-center h-64 outline-none",
                isDragOver &&
                  "ring-4 ring-[var(--md-sys-color-primary)]/35 border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/25",
              )}
              aria-label="Upload audio file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={AUDIO_FILE_INPUT_ACCEPT}
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-16 h-16 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileAudio className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-[var(--md-sys-color-on-surface)]">
                Upload Audio
              </h3>
              <p className="text-[var(--md-sys-color-on-surface-variant)] text-center mt-2 text-sm">
                {isDragOver
                  ? "Drop your audio file here"
                  : `Click or drag and drop (${SUPPORTED_AUDIO_FORMATS_LABEL})`}
              </p>
            </div>

            {/* Record */}
            <button
              onClick={startRecording}
              className="group bg-[var(--md-sys-color-surface-container)] p-8 rounded-[28px] shadow-[0_4px_18px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(176,54,74,0.24)] transition-all cursor-pointer flex flex-col items-center justify-center h-64"
            >
              <div className="w-16 h-16 bg-rose-200/80 dark:bg-rose-900/45 text-rose-700 dark:text-rose-300 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-[var(--md-sys-color-on-surface)]">
                Record Voice
              </h3>
              <p className="text-[var(--md-sys-color-on-surface-variant)] text-center mt-2 text-sm">
                Tap to start recording
              </p>
            </button>
          </div>
        ) : null}

        {/* Recording State */}
        {status === "recording" && (
          <div className="flex flex-col items-center justify-center py-12 bg-[var(--md-sys-color-surface-container)] rounded-[32px] shadow-[0_8px_24px_rgba(60,20,31,0.18)] border border-rose-300/30">
            <div className="w-20 h-20 bg-rose-600 rounded-[24px] flex items-center justify-center mb-6 shadow-lg shadow-rose-300/40 dark:shadow-none">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] mb-2">
              Recording...
            </h2>
            <p className="text-[var(--md-sys-color-on-surface-variant)] mb-8">
              Speak clearly into the microphone
            </p>
            <div className="audio-visualizer mb-8" aria-hidden="true">
              {visualizerBars.map((bar) => (
                <span
                  key={bar}
                  className="audio-visualizer-bar"
                  style={{ animationDelay: `${bar * 0.11}s` }}
                />
              ))}
            </div>
            <button
              onClick={stopRecording}
              className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-rose-700 flex items-center gap-2 shadow-md transition-all hover:scale-105"
            >
              <StopCircle className="w-5 h-5" /> Stop Recording
            </button>
          </div>
        )}

        {/* Processing State */}
        {(status === "processing" || status === "transcribing") && (
          <div className="flex flex-col items-center justify-center py-12 bg-[var(--md-sys-color-surface-container)] rounded-[32px] border border-[color:var(--md-sys-color-outline)]/30 shadow-[0_8px_24px_rgba(39,80,196,0.14)]">
            <Loader2 className="w-12 h-12 text-[var(--md-sys-color-primary)] animate-spin mb-6" />
            <h2 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] mb-2">
              Processing Audio
            </h2>
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-lg">
              {progress}
            </p>
          </div>
        )}

        {/* Result State */}
        {status === "done" && (
          <div className="bg-[var(--md-sys-color-surface-container)] rounded-[30px] shadow-[0_8px_24px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 overflow-hidden">
            <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-b border-[color:var(--md-sys-color-outline)]/30 flex justify-between items-center">
              <h3 className="font-bold text-[var(--md-sys-color-on-surface)]">
                Transcription Result
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className={cn(
                    "p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl transition-colors",
                    isCopied
                      ? "text-[var(--md-sys-color-primary)]"
                      : "text-[var(--md-sys-color-on-surface-variant)]",
                  )}
                  title={isCopied ? "Copied" : "Copy"}
                  aria-label={
                    isCopied ? "Copied to clipboard" : "Copy to clipboard"
                  }
                >
                  {isCopied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={downloadText}
                  className="p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-[var(--md-sys-color-on-surface-variant)]"
                  title="Save"
                >
                  <Save className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea
                className="w-full h-96 p-4 rounded-2xl text-[var(--md-sys-color-on-surface)] bg-[var(--md-sys-color-surface)] leading-relaxed outline-none resize-none border border-[color:var(--md-sys-color-outline)]/20"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
              />
            </div>
            <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-t border-[color:var(--md-sys-color-outline)]/30 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  setStatus("idle");
                  setTranslationInitialText("");
                }}
                className="text-[var(--md-sys-color-primary)] font-bold hover:opacity-80"
              >
                Transcribe Another File
              </button>
              {/* 7.5 — Translate result CTA */}
              <button
                onClick={handleTranslateResult}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all",
                  deepLKeyConfigured
                    ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] hover:opacity-90"
                    : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] hover:opacity-80",
                )}
                title={
                  deepLKeyConfigured
                    ? "Translate with DeepL"
                    : "Add a DeepL API key in Settings to translate"
                }
              >
                <Languages className="w-4 h-4" />
                Translate result
              </button>
            </div>
          </div>
        )}

        {/* Translation Card — always visible (below transcript when status=done, standalone otherwise) */}
        <div ref={translationCardRef}>
          <TranslationCard
            apiKey={deepLApiKey}
            plan={deepLPlan}
            initialText={translationInitialText}
            defaultTargetLang={deepLDefaultTargetLang}
            usage={deepLUsage}
          />
        </div>
      </main>

      <footer className="w-full py-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)] opacity-60">
        <p>
          Version {pkg.version} • © 2026{" "}
          <a
            href="https://jshep.xyz/profile/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-[var(--md-sys-color-primary)] transition-colors"
          >
            JoeShep
          </a>
        </p>
      </footer>
    </div>
  );
}
