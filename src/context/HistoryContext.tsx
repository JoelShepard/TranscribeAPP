import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type TranscriptionSource = 'upload' | 'recording';

export interface TranscriptionHistoryItem {
  id: string;
  fileName: string;
  durationSeconds: number;
  source: TranscriptionSource;
  transcriptionChars: number;
  wordCount: number;
  createdAt: string;
}

interface NewHistoryItem {
  fileName: string;
  durationSeconds: number;
  source: TranscriptionSource;
  transcriptionChars: number;
  wordCount: number;
}

interface HistoryContextType {
  history: TranscriptionHistoryItem[];
  addHistoryItem: (item: NewHistoryItem) => void;
  clearHistory: () => void;
}

const HISTORY_STORAGE_KEY = 'transcription_history';
const HISTORY_LIMIT = 50;

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

function isHistoryItem(value: unknown): value is TranscriptionHistoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.durationSeconds === 'number' &&
    Number.isFinite(item.durationSeconds) &&
    (item.source === 'upload' || item.source === 'recording') &&
    typeof item.transcriptionChars === 'number' &&
    Number.isFinite(item.transcriptionChars) &&
    typeof item.wordCount === 'number' &&
    Number.isFinite(item.wordCount) &&
    typeof item.createdAt === 'string'
  );
}

function parseStoredHistory(rawHistory: string | null): TranscriptionHistoryItem[] {
  if (!rawHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isHistoryItem);
  } catch (err: unknown) {
    console.error('[HistoryContext] Failed to parse history from localStorage:', err);
    return [];
  }
}

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<TranscriptionHistoryItem[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parseStoredHistory(localStorage.getItem(HISTORY_STORAGE_KEY));
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addHistoryItem = useCallback((item: NewHistoryItem) => {
    setHistory((currentHistory) => {
      const nextItem: TranscriptionHistoryItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      return [nextItem, ...currentHistory].slice(0, HISTORY_LIMIT);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const contextValue = useMemo(
    () => ({
      history,
      addHistoryItem,
      clearHistory,
    }),
    [addHistoryItem, clearHistory, history],
  );

  return <HistoryContext.Provider value={contextValue}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }

  return context;
}
