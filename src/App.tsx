import React, { useState, useEffect, useRef } from 'react';
import { Mic, FileAudio, Settings, Save, Copy, Loader2, StopCircle, Sun, Moon, AudioLines, ExternalLink } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';
import { audioProcessor } from './services/audio/AudioProcessor';
import { MistralClient } from './services/mistral/MistralClient';
import { useTheme } from './context/ThemeContext';
import { TitleBar } from './components/TitleBar';
import { isTauriRuntime } from './utils/platform';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'recording' | 'processing' | 'transcribing' | 'done' | 'error';

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
      return 'Browser-level microphone access failed on Linux Tauri. Native recorder should be used automatically; try recording again.';
    }

    return 'Microphone permission denied. Enable microphone access for this app in system/browser settings and try again.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone detected. Connect a microphone and try again.';
  }
  if (name === 'NotReadableError') {
    return 'Microphone is busy or unavailable. Close other apps using it and try again.';
  }
  if (name === 'SecurityError') {
    return 'Recording requires a secure context. Start the app with `bun run dev` or `bun run dev:tauri`.';
  }

  return `Microphone access error: ${name || 'Unknown'} (${message || 'No details'})`;
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
      return 'Unknown error';
    }
  }

  return 'Unknown error';
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [tauriEnv, setTauriEnv] = useState(false);
  const [linuxEnv, setLinuxEnv] = useState(false);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaMimeTypeRef = useRef('audio/webm');
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setTauriEnv(isTauriRuntime());
    setLinuxEnv(isLinuxPlatform());
    const storedKey = localStorage.getItem('mistral_api_key');
    if (storedKey) setApiKey(storedKey);
    
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('mistral_api_key', apiKey);
    setShowSettings(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAudio(file);
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
        setError(`Native microphone error: ${getErrorDetails(err)}`);
        setStatus('error');
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording is not supported in this environment. Use Upload Audio as fallback.');
      setStatus('error');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not available in this environment. Use Upload Audio as fallback.');
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
        await processAudio(file);
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
        await processAudio(file);
      } catch (err: unknown) {
        console.error('[App] Error stopping native recording:', err);
        setError(`Native microphone error: ${getErrorDetails(err)}`);
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
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      if (isTauriRuntime() && isLinuxPlatform()) {
        void invoke('stop_native_recording').catch(() => {
          // Ignore cleanup errors.
        });
      }
    };
  }, []);

  const processAudio = async (file: File) => {
    console.log('[App] Starting processAudio for file:', file.name, 'size:', file.size, 'type:', file.type);
    
    if (!apiKey) {
      console.error('[App] No API key set');
      setError('Please set your Mistral API Key first.');
      setShowSettings(true);
      return;
    }

    try {
      setError('');
      setTranscription('');
      setStatus('processing');
      setProgress('Analyzing audio...');
      
      console.log('[App] Getting audio duration...');

      // 1. Get Duration and Decide logic
      const duration = await audioProcessor.getAudioDuration(file);
      console.log(`[App] Audio Duration: ${duration}s`);

      const client = new MistralClient(apiKey);
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
      setTranscription(fullTranscription);
      setStatus('done');
      setProgress('');
      console.log('[App] Process complete ✓');

    } catch (err: any) {
      console.error('[App] Error during processing:', err);
      console.error('[App] Error stack:', err.stack);
      
      let errorMessage = err.message || 'An error occurred during processing';
      
      // Handle specifically 401 Unauthorized
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        errorMessage = 'Invalid API Key. Please check your Mistral API Key in settings.';
        setShowSettings(true); // Auto-open settings
      }

      setError(errorMessage);
      setStatus('error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    alert('Copied to clipboard!');
  };

  const downloadText = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
  };

  return (
    <div className={cn(
      "min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200 relative overflow-x-hidden",
      tauriEnv && "pt-10"
    )}>
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[var(--md-sys-color-primary-container)]/60 blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-0 h-80 w-80 rounded-full bg-[var(--md-sys-color-secondary-container)]/50 blur-3xl" />
      <TitleBar />
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-10 transition-colors duration-200 pt-[env(safe-area-inset-top)]",
        tauriEnv && "top-10"
      )}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center rounded-[28px] border border-[color:var(--md-sys-color-outline)]/30 bg-[var(--md-sys-color-surface-container)]/90 backdrop-blur-sm px-5 py-4 shadow-[0_6px_24px_rgba(22,27,45,0.10)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.28)]">
          <button 
            onClick={() => {
              setStatus('idle');
              setTranscription('');
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
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface-variant)]"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2.5 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:opacity-90 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
          </div>
        </div>
      </header>

      {/* Settings Modal/Area */}
      {showSettings && (
        <div className="mx-4 max-w-5xl md:mx-auto mb-2 rounded-[30px] border border-[color:var(--md-sys-color-outline)]/30 bg-[var(--md-sys-color-surface-container)] p-6 animate-in slide-in-from-top-2 shadow-[0_8px_28px_rgba(22,27,45,0.10)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
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
                        onClick={saveApiKey}
                        className="bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] px-7 py-3 rounded-2xl hover:opacity-90 font-bold"
                    >
                        Save
                    </button>
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

      <main className="relative max-w-4xl mx-auto p-6 space-y-8">
        
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
                <label className="group bg-[var(--md-sys-color-surface-container)] p-8 rounded-[28px] shadow-[0_4px_18px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(39,80,196,0.22)] transition-all cursor-pointer flex flex-col items-center justify-center h-64">
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <div className="w-16 h-16 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileAudio className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[var(--md-sys-color-on-surface)]">Upload Audio</h3>
                    <p className="text-[var(--md-sys-color-on-surface-variant)] text-center mt-2 text-sm">MP3, WAV, M4A, OGG</p>
                </label>

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
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--md-sys-color-surface-container)] rounded-[32px] shadow-[0_8px_24px_rgba(60,20,31,0.18)] border border-rose-300/30 animate-pulse">
                <div className="w-20 h-20 bg-rose-600 rounded-[24px] flex items-center justify-center mb-6 shadow-lg shadow-rose-300/40 dark:shadow-none">
                    <Mic className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] mb-2">Recording...</h2>
                <p className="text-[var(--md-sys-color-on-surface-variant)] mb-8">Speak clearly into the microphone</p>
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
                        <button onClick={copyToClipboard} className="p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-[var(--md-sys-color-on-surface-variant)]" title="Copy">
                            <Copy className="w-5 h-5" />
                        </button>
                        <button onClick={downloadText} className="p-2.5 hover:bg-[var(--md-sys-color-surface-container-highest)] rounded-xl text-[var(--md-sys-color-on-surface-variant)]" title="Save">
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
                <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-t border-[color:var(--md-sys-color-outline)]/30 text-center">
                    <button 
                        onClick={() => setStatus('idle')}
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
