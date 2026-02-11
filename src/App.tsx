import React, { useState, useEffect, useRef } from 'react';
import { Mic, FileAudio, Settings, Save, Copy, Check, Loader2, StopCircle, Sun, Moon, AudioLines, ExternalLink, History, X, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
import { audioProcessor } from './services/audio/AudioProcessor';
import { MistralClient } from './services/mistral/MistralClient';
import { useTheme } from './context/ThemeContext';
import { useHistory } from './context/HistoryContext';
import { TitleBar } from './components/TitleBar';
import { isTauriRuntime } from './utils/platform';
import {
  ERROR_MESSAGES,
  formatMicrophoneAccessError,
  formatNativeMicrophoneError,
} from './constants/messages';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'recording' | 'processing' | 'transcribing' | 'done' | 'error';
type ProcessingSource = 'upload' | 'recording';

const TRANSCRIPTION_MODELS = [
  { value: 'voxtral-mini-latest', label: 'voxtral-mini-latest (default)' },
  { value: 'mistral-small', label: 'mistral-small' },
  { value: 'mistral-tiny', label: 'mistral-tiny' },
] as const;

const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].value;

interface ResultMetadata {
  fileName: string;
  durationSeconds: number;
  source: ProcessingSource;
  transcriptionChars: number;
  wordCount: number;
  processedAt: string;
}

function isLinuxPlatform(): boolean {
  return typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent);
}

function getRecordingErrorMessage(
  err: unknown,
  context: { tauriEnv: boolean; linuxEnv: boolean },
): string {
  const name = (err as any)?.name;
  const message = (err as any)?.message;
  const isLinuxTauri = context.tauriEnv && context.linuxEnv;

  if (name === 'NotAllowedError' || message?.toLowerCase().includes('permission denied')) {
    if (isLinuxTauri) {
      return ERROR_MESSAGES.tauriLinuxPermissionDenied;
    }

    return ERROR_MESSAGES.microphonePermissionDenied;
  }
  if (name === 'NotFoundError') {
    return ERROR_MESSAGES.noMicrophoneDetected;
  }
  if (name === 'NotReadableError') {
    return ERROR_MESSAGES.microphoneBusy;
  }
  if (name === 'SecurityError') {
    return ERROR_MESSAGES.secureContextRequired;
  }

  return formatMicrophoneAccessError(name || ERROR_MESSAGES.unknownError, message || ERROR_MESSAGES.noErrorDetails);
}

function getErrorDetails(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }

  if (err && typeof err === 'object') {
    const maybeMessage = (err as any).message;
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
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
  const { history, addHistoryItem, clearHistory } = useHistory();
  const [apiKey, setApiKey] = useState('');
  const [transcriptionModel, setTranscriptionModel] = useState<string>(DEFAULT_TRANSCRIPTION_MODEL);
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [transcription, setTranscription] = useState('');
  const [resultMetadata, setResultMetadata] = useState<ResultMetadata | null>(null);
  const [error, setError] = useState('');
  const [tauriEnv, setTauriEnv] = useState(() => isTauriRuntime());
  const [linuxEnv, setLinuxEnv] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaMimeTypeRef = useRef('audio/webm');
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTauriEnv(isTauriRuntime());
    setLinuxEnv(isLinuxPlatform());
    const storedKey = localStorage.getItem('mistral_api_key');
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem('mistral_model');
    if (storedModel) {
      const matchingModel = TRANSCRIPTION_MODELS.find((model) => model.value === storedModel);
      if (matchingModel) {
        setTranscriptionModel(matchingModel.value);
      }
    }
    const storedSourceLanguage = localStorage.getItem('mistral_source_language');
    if (storedSourceLanguage) {
      setSourceLanguage(storedSourceLanguage);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('mistral_api_key', apiKey);
    localStorage.setItem('mistral_model', transcriptionModel);
    localStorage.setItem('mistral_source_language', sourceLanguage.trim());
    setShowSettings(false);
  };

  const handleSettingsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowSettings(false);
      return;
    }

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      saveSettings();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processAudio(file, 'upload');
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setError(ERROR_MESSAGES.invalidAudioFile);
      setStatus('error');
      return;
    }

    await processAudio(file, 'upload');
  };

  const startRecording = async () => {
    const useNativeRecorder = tauriEnv && linuxEnv;

    if (useNativeRecorder) {
      try {
        setError('');
        console.log('[App] Starting native microphone recording...');
        await invoke('start_native_recording');
        setStatus('recording');
      } catch (err: unknown) {
        console.error('[App] Error starting native recording:', err);
        setError(formatNativeMicrophoneError(getErrorDetails(err)));
        setStatus('error');
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(ERROR_MESSAGES.recordingNotSupported);
      setStatus('error');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError(ERROR_MESSAGES.mediaRecorderNotAvailable);
      setStatus('error');
      return;
    }

    try {
      console.log('[App] Requesting microphone access...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('[App] Available devices:', devices.map(d => `${d.kind}: ${d.label}`));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[App] Microphone access granted');
      mediaStreamRef.current = stream;

      const mimeTypeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const selectedMimeType = mimeTypeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      mediaMimeTypeRef.current = selectedMimeType ?? 'audio/webm';
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaMimeTypeRef.current;
        const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording.${extension}`, { type: mimeType });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        await processAudio(file, 'recording');
      };

      mediaRecorder.start();
      setStatus('recording');
    } catch (err: unknown) {
      console.error('[App] Error starting recording:', err);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setError(getRecordingErrorMessage(err, { tauriEnv, linuxEnv }));
      setStatus('error');
    }
  };

  const stopRecording = async () => {
    if (status !== 'recording') {
      return;
    }

    const useNativeRecorder = tauriEnv && linuxEnv;
    if (useNativeRecorder) {
      try {
        setStatus('processing');
        setProgress('Finalizing native recording...');
        const audioBytes = await invoke<number[]>('stop_native_recording');
        const audioData = Uint8Array.from(audioBytes);
        const file = new File([audioData], 'recording.wav', { type: 'audio/wav' });
        await processAudio(file, 'recording');
      } catch (err: unknown) {
        console.error('[App] Error stopping native recording:', err);
        setError(formatNativeMicrophoneError(getErrorDetails(err)));
        setProgress('');
        setStatus('error');
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
        void invoke('stop_native_recording').catch(() => {
          // Ignore cleanup errors.
        });
      }
    };
  }, []);

  const processAudio = async (file: File, source: ProcessingSource) => {
    console.log('[App] Starting processAudio for file:', file.name, 'size:', file.size, 'type:', file.type);
    
    if (!apiKey) {
      console.error('[App] No API key set');
      setError(ERROR_MESSAGES.missingApiKey);
      setShowSettings(true);
      return;
    }

    try {
      setError('');
      setTranscription('');
      setResultMetadata(null);
      setStatus('processing');
      setProgress('Analyzing audio...');
      
      console.log('[App] Getting audio duration...');

      // 1. Get Duration and Decide logic
      const duration = await audioProcessor.getAudioDuration(file);
      console.log(`[App] Audio Duration: ${duration}s`);

      const client = new MistralClient(apiKey, transcriptionModel, sourceLanguage);
      let results: string[] = [];

      // Thresholds: 15 mins (900s) or 25MB (approx check)
      // We rely on duration mostly for splitting logic
      if (duration > 900) {
         console.log('[App] File exceeds 15 minutes, splitting...');
         setProgress('Splitting long audio file...');
         const chunks = await audioProcessor.splitAudio(file);
         console.log(`[App] Split into ${chunks.length} chunks`);
         
         setStatus('transcribing');
         for (let i = 0; i < chunks.length; i++) {
            console.log(`[App] Transcribing chunk ${i + 1}/${chunks.length}...`);
            setProgress(`Transcribing chunk ${i + 1} of ${chunks.length}...`);
            const text = await client.transcribe(chunks[i]!); // Use ! assertion as we know it exists
            console.log(`[App] Chunk ${i + 1} transcribed, length: ${text.length} chars`);
            results.push(text);
         }
      } else {
         console.log('[App] File under 15 minutes, normalizing...');
         setProgress('Normalizing audio...');
         const normalizedBlob = await audioProcessor.normalizeAudio(file);
         console.log('[App] Normalized blob size:', normalizedBlob.size);
         
         setStatus('transcribing');
         setProgress('Sending to Mistral AI...');
         console.log('[App] Sending to Mistral API...');
         const text = await client.transcribe(normalizedBlob);
         console.log('[App] Transcription received, length:', text.length, 'chars');
         results.push(text);
      }

      const fullTranscription = results.join(' ');
      console.log('[App] Full transcription length:', fullTranscription.length, 'chars');
      const wordCount = fullTranscription.trim().length > 0 ? fullTranscription.trim().split(/\s+/).length : 0;
      const processedAt = new Date().toISOString();

      addHistoryItem({
        fileName: file.name,
        durationSeconds: duration,
        source,
        transcriptionChars: fullTranscription.length,
        wordCount,
      });

      setResultMetadata({
        fileName: file.name,
        durationSeconds: duration,
        source,
        transcriptionChars: fullTranscription.length,
        wordCount,
        processedAt,
      });

      setTranscription(fullTranscription);
      setStatus('done');
      setProgress('');
      console.log('[App] Process complete ✓');

    } catch (err: any) {
      console.error('[App] Error during processing:', err);
      console.error('[App] Error stack:', err.stack);
      
      let errorMessage = err.message || ERROR_MESSAGES.processingFailed;
      
      // Handle specifically 401 Unauthorized
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        errorMessage = ERROR_MESSAGES.invalidApiKey;
        setShowSettings(true); // Auto-open settings
      }

      setError(errorMessage);
      setStatus('error');
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
      console.error('[App] Error copying transcription to clipboard:', err);
      setError(ERROR_MESSAGES.clipboardCopyFailed);
    }
  };

  const downloadText = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToMarkdown = () => {
    const markdown = [
      '# Transcription Result',
      '',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '## Transcript',
      '',
      transcription || '_No transcription available._',
      '',
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJson = () => {
    const exportDate = new Date().toISOString();
    const metadata = resultMetadata
      ? {
          ...resultMetadata,
          durationFormatted: formatDuration(resultMetadata.durationSeconds),
        }
      : {
          fileName: 'unknown',
          durationSeconds: 0,
          durationFormatted: formatDuration(0),
          source: 'upload' as ProcessingSource,
          transcriptionChars: transcription.length,
          wordCount: transcription.trim().length > 0 ? transcription.trim().split(/\s+/).length : 0,
          processedAt: exportDate,
        };

    const payload = {
      metadata: {
        ...metadata,
        exportedAt: exportDate,
      },
      transcript: transcription,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCreatedAt = (dateValue: string) => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown date';
    }

    return parsed.toLocaleString();
  };

  return (
    <div className={cn(
      "min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200 relative overflow-x-hidden",
      tauriEnv && "pt-8"
    )}>
      <div className="pointer-events-none absolute top-16 -left-10 h-56 w-56 rounded-full bg-[var(--md-sys-color-primary-container)]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 right-0 h-64 w-64 rounded-full bg-[var(--md-sys-color-secondary-container)]/15 blur-3xl" />
      <TitleBar />
      {/* Header */}
      <header className={cn(
        "sticky z-10 transition-colors duration-200 mb-14",
        tauriEnv ? "top-8" : "top-0 pt-[env(safe-area-inset-top)]"
      )}>
        <div className={cn("max-w-4xl mx-auto px-6", tauriEnv ? "py-2" : "py-4")}>
          {(() => {
            const logoContent = (
              <button 
                onClick={() => {
                  setStatus('idle');
                  setTranscription('');
                  setResultMetadata(null);
                  setError('');
                }}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                aria-label="Go to Home"
              >
                 <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] shadow-[0_8px_18px_rgba(39,80,196,0.30)]">
                   <AudioLines className="w-5 h-5" />
                 </div>
                 <h1 className="text-xl font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)]">TranscribeJS</h1>
              </button>
            );

            const actionsContent = (
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleTheme}
                  className="p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface-variant)]"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                </button>
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface-variant)]"
                  aria-label="Open history"
                >
                  <History className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:opacity-90 transition-colors"
                  aria-label="Settings"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            );

            const pillClass = "rounded-[28px] border border-[color:var(--md-sys-color-outline)]/20 bg-[var(--md-sys-color-surface-container)]/90 backdrop-blur-sm px-5 shadow-[0_4px_16px_rgba(22,27,45,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.20)]";
            const paddingClass = tauriEnv ? "py-2" : "py-4";

            if (tauriEnv) {
               return (
                 <div className="flex justify-between items-center gap-4 w-full">
                    <div className={cn(pillClass, paddingClass, "flex items-center flex-1")}>
                      {logoContent}
                    </div>
                    <div className={cn(pillClass, paddingClass, "flex items-center")}>
                      {actionsContent}
                    </div>
                 </div>
               );
            }

            return (
              <div className={cn(
                "flex justify-between items-center",
                pillClass,
                paddingClass
              )}>
                {logoContent}
                {actionsContent}
              </div>
            );
          })()}
        </div>
      </header>

      {/* Settings Modal/Area */}
      {showSettings && (
        <div
          onKeyDown={handleSettingsKeyDown}
          className="mx-6 max-w-4xl md:mx-auto mb-2 rounded-[30px] border border-[color:var(--md-sys-color-outline)]/30 bg-[var(--md-sys-color-surface-container)] p-6 animate-in slide-in-from-top-2 shadow-[0_8px_28px_rgba(22,27,45,0.10)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
        >
            <div className="max-w-2xl mx-auto">
                <label className="block text-base font-semibold text-[var(--md-sys-color-on-surface)] mb-2">Mistral API Key</label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API Key"
                        className="flex-1 p-3.5 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none"
                    />
                    <button 
                        onClick={saveSettings}
                        className="bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] px-7 py-3 rounded-2xl hover:opacity-90 font-bold"
                    >
                        Save
                    </button>
                </div>
                <div className="mt-4">
                  <label className="block text-base font-semibold text-[var(--md-sys-color-on-surface)] mb-2">Transcription Model</label>
                  <select
                    value={transcriptionModel}
                    onChange={(e) => setTranscriptionModel(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none"
                  >
                    {TRANSCRIPTION_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <label className="block text-base font-semibold text-[var(--md-sys-color-on-surface)] mb-2">Source Language (optional)</label>
                  <input
                    type="text"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    placeholder="Auto-detect (e.g. en, it, fr)"
                    className="w-full p-3.5 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none"
                  />
                </div>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-3">Key is stored locally on your device.</p>
                <a
                  href="https://console.mistral.ai/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--md-sys-color-primary)] underline underline-offset-2 hover:opacity-85"
                >
                  Create a new API key on Mistral
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close history panel"
            onClick={() => setShowHistory(false)}
          />
          <aside className="relative z-10 h-full w-full max-w-md bg-[var(--md-sys-color-surface)] shadow-[-14px_0_40px_rgba(16,20,36,0.28)] border-l border-[color:var(--md-sys-color-outline)]/25 flex flex-col animate-in slide-in-from-right-10 duration-200">
            <div className="px-5 py-4 border-b border-[color:var(--md-sys-color-outline)]/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--md-sys-color-primary)]" />
                <h2 className="text-lg font-bold text-[var(--md-sys-color-on-surface)]">Transcription History</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-2 rounded-xl hover:bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)]"
                aria-label="Close history"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[color:var(--md-sys-color-outline)]/20 flex justify-between items-center gap-3">
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {history.length} {history.length === 1 ? 'item' : 'items'} saved locally
              </p>
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] hover:opacity-90 disabled:opacity-50"
                disabled={history.length === 0}
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-[color:var(--md-sys-color-outline)]/40 text-center p-6">
                  <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    No transcriptions yet. Upload or record audio to build your history.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-[color:var(--md-sys-color-outline)]/25 bg-[var(--md-sys-color-surface-container)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-sm text-[var(--md-sys-color-on-surface)] break-all">{item.fileName}</h3>
                        <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                          {item.source === 'recording' ? 'Recording' : 'Upload'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{formatCreatedAt(item.createdAt)}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-[var(--md-sys-color-surface)] px-2 py-1.5 border border-[color:var(--md-sys-color-outline)]/20">
                          <p className="text-[var(--md-sys-color-on-surface-variant)]">Duration</p>
                          <p className="font-semibold text-[var(--md-sys-color-on-surface)]">{formatDuration(item.durationSeconds)}</p>
                        </div>
                        <div className="rounded-xl bg-[var(--md-sys-color-surface)] px-2 py-1.5 border border-[color:var(--md-sys-color-outline)]/20">
                          <p className="text-[var(--md-sys-color-on-surface-variant)]">Chars</p>
                          <p className="font-semibold text-[var(--md-sys-color-on-surface)]">{item.transcriptionChars.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl bg-[var(--md-sys-color-surface)] px-2 py-1.5 border border-[color:var(--md-sys-color-outline)]/20">
                          <p className="text-[var(--md-sys-color-on-surface-variant)]">Words</p>
                          <p className="font-semibold text-[var(--md-sys-color-on-surface)]">{item.wordCount.toLocaleString()}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <main className="relative max-w-4xl mx-auto px-6 pb-6 space-y-8">
        
        {/* Error Banner */}
        {error && (
            <div className="bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-4 rounded-2xl border border-red-300/40 flex items-center gap-2 shadow-sm">
                <span className="font-bold">Error:</span> {error}
            </div>
        )}

        {/* Input Area */}
        {status === 'idle' || status === 'error' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
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
                      'group bg-[var(--md-sys-color-surface-container)] p-8 rounded-[28px] shadow-[0_4px_18px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(39,80,196,0.22)] transition-all cursor-pointer flex flex-col items-center justify-center h-64 outline-none',
                      isDragOver && 'ring-4 ring-[var(--md-sys-color-primary)]/35 border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/25'
                    )}
                    aria-label="Upload audio file"
                >
                    <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <div className="w-16 h-16 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileAudio className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[var(--md-sys-color-on-surface)]">Upload Audio</h3>
                    <p className="text-[var(--md-sys-color-on-surface-variant)] text-center mt-2 text-sm">
                      {isDragOver ? 'Drop your audio file here' : 'Click or drag and drop (MP3, WAV, M4A, OGG)'}
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
                    <h3 className="text-xl font-extrabold text-[var(--md-sys-color-on-surface)]">Record Voice</h3>
                    <p className="text-[var(--md-sys-color-on-surface-variant)] text-center mt-2 text-sm">Tap to start recording</p>
                </button>
             </div>
        ) : null}

        {/* Recording State */}
        {status === 'recording' && (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--md-sys-color-surface-container)] rounded-[32px] shadow-[0_8px_24px_rgba(60,20,31,0.18)] border border-rose-300/30">
                <div className="w-20 h-20 bg-rose-600 rounded-[24px] flex items-center justify-center mb-6 shadow-lg shadow-rose-300/40 dark:shadow-none">
                    <Mic className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] mb-2">Recording...</h2>
                <p className="text-[var(--md-sys-color-on-surface-variant)] mb-8">Speak clearly into the microphone</p>
                <div className="audio-visualizer mb-8" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((bar) => (
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
        {(status === 'processing' || status === 'transcribing') && (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--md-sys-color-surface-container)] rounded-[32px] border border-[color:var(--md-sys-color-outline)]/30 shadow-[0_8px_24px_rgba(39,80,196,0.14)]">
                <Loader2 className="w-12 h-12 text-[var(--md-sys-color-primary)] animate-spin mb-6" />
                <h2 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] mb-2">Processing Audio</h2>
                <p className="text-[var(--md-sys-color-on-surface-variant)] text-lg">{progress}</p>
            </div>
        )}

        {/* Result State */}
        {status === 'done' && (
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-[30px] shadow-[0_8px_24px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 overflow-hidden">
                <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-b border-[color:var(--md-sys-color-outline)]/30 flex justify-between items-center">
                    <h3 className="font-bold text-[var(--md-sys-color-on-surface)]">Transcription Result</h3>
                    <div className="flex gap-2">
                        <button
                          onClick={copyToClipboard}
                          className={cn(
                            'p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl transition-colors',
                            isCopied
                              ? 'text-[var(--md-sys-color-primary)]'
                              : 'text-[var(--md-sys-color-on-surface-variant)]'
                          )}
                          title={isCopied ? 'Copied' : 'Copy'}
                          aria-label={isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}
                        >
                            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                        <button onClick={downloadText} className="p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-[var(--md-sys-color-on-surface-variant)]" title="Save">
                            <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={exportToMarkdown}
                          className="px-3 py-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]"
                          title="Export Markdown"
                        >
                          .md
                        </button>
                        <button
                          onClick={exportToJson}
                          className="px-3 py-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]"
                          title="Export JSON"
                        >
                          .json
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
                <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-t border-[color:var(--md-sys-color-outline)]/30 text-center">
                    <button 
                        onClick={() => {
                          setStatus('idle');
                          setResultMetadata(null);
                        }}
                        className="text-[var(--md-sys-color-primary)] font-bold hover:opacity-80"
                    >
                        Transcribe Another File
                    </button>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}
