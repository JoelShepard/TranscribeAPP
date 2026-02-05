import React, { useState, useEffect, useRef } from 'react';
import { Mic, FileAudio, Settings, Save, Copy, Loader2, StopCircle, Sun, Moon } from 'lucide-react';
import { audioProcessor } from './services/audio/AudioProcessor';
import { MistralClient } from './services/mistral/MistralClient';
import { useTheme } from './context/ThemeContext';

type Status = 'idle' | 'recording' | 'processing' | 'transcribing' | 'done' | 'error';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        await processAudio(file);
      };

      mediaRecorder.start();
      setStatus('recording');
    } catch (err) {
      setError('Microphone access denied or not available.');
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm dark:border-b dark:border-gray-800 sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">T</div>
             <h1 className="text-xl font-bold text-gray-800 dark:text-white">TranscribeJS</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal/Area */}
      {showSettings && (
        <div className="bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 p-6 animate-in slide-in-from-top-2">
            <div className="max-w-2xl mx-auto">
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Mistral API Key</label>
                <div className="flex gap-2">
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API Key"
                        className="flex-1 p-3 rounded-lg border border-blue-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        onClick={saveApiKey}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                    >
                        Save
                    </button>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">Key is stored locally on your device.</p>
            </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        
        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                <span className="font-bold">Error:</span> {error}
            </div>
        )}

        {/* Input Area */}
        {status === 'idle' || status === 'error' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload */}
                <label className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer flex flex-col items-center justify-center h-64">
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileAudio className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upload Audio</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">MP3, WAV, M4A, OGG</p>
                </label>

                {/* Record */}
                <button 
                    onClick={startRecording}
                    className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all cursor-pointer flex flex-col items-center justify-center h-64"
                >
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Record Voice</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">Tap to start recording</p>
                </button>
             </div>
        ) : null}

        {/* Recording State */}
        {status === 'recording' && (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900 animate-pulse">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-200 dark:shadow-none">
                    <Mic className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Recording...</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Speak clearly into the microphone</p>
                <button 
                    onClick={stopRecording}
                    className="bg-red-600 text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 flex items-center gap-2 shadow-md transition-all hover:scale-105"
                >
                    <StopCircle className="w-5 h-5" /> Stop Recording
                </button>
            </div>
        )}

        {/* Processing State */}
        {(status === 'processing' || status === 'transcribing') && (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Processing Audio</h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg">{progress}</p>
            </div>
        )}

        {/* Result State */}
        {status === 'done' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200">Transcription Result</h3>
                    <div className="flex gap-2">
                        <button onClick={copyToClipboard} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300" title="Copy">
                            <Copy className="w-5 h-5" />
                        </button>
                        <button onClick={downloadText} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300" title="Save">
                            <Save className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-6">
                    <textarea 
                        className="w-full h-96 p-4 text-gray-800 dark:text-gray-200 bg-transparent leading-relaxed outline-none resize-none"
                        value={transcription}
                        onChange={(e) => setTranscription(e.target.value)}
                    />
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <button 
                        onClick={() => setStatus('idle')}
                        className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300"
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
