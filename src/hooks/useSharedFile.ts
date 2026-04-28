import { useEffect, useRef, useCallback } from "react";
import { isCapacitorRuntime } from "../utils/platform";
import { isSupportedAudioFile } from "../utils/audioFormats";

interface SharedFileEvent {
  fileName: string;
  mimeType: string;
  content: string;
}

declare global {
  interface Window {
    __TRANSCRIBE_PENDING_SHARED_FILE__?: SharedFileEvent;
  }
}

export function sharedFileEventToFile({
  fileName,
  mimeType,
  content,
}: SharedFileEvent): File {
  const binaryString = atob(content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mimeType });
}

export function useSharedFile(
  onFileReceived: (file: File) => Promise<void>,
) {
  const onFileReceivedRef = useRef(onFileReceived);

  useEffect(() => {
    onFileReceivedRef.current = onFileReceived;
  }, [onFileReceived]);

  const processSharedFile = useCallback(async (detail: SharedFileEvent) => {
    const { fileName, mimeType } = detail;

    console.log("[useSharedFile] Received shared file:", fileName, mimeType);

    try {
      delete window.__TRANSCRIBE_PENDING_SHARED_FILE__;

      const file = sharedFileEventToFile(detail);

      if (!isSupportedAudioFile(file)) {
        console.warn("[useSharedFile] Unsupported audio format:", mimeType, fileName);
        return;
      }

      await onFileReceivedRef.current(file);
    } catch (err) {
      console.error("[useSharedFile] Error processing shared file:", err);
    }
  }, []);

  const handleSharedFile = useCallback(async (event: Event) => {
    const customEvent = event as CustomEvent<SharedFileEvent>;
    await processSharedFile(customEvent.detail);
  }, [processSharedFile]);

  useEffect(() => {
    if (!isCapacitorRuntime()) {
      return;
    }

    window.addEventListener("sharedFileReceived", handleSharedFile);

    const pendingSharedFile = window.__TRANSCRIBE_PENDING_SHARED_FILE__;
    if (pendingSharedFile) {
      void processSharedFile(pendingSharedFile);
    }

    return () => {
      window.removeEventListener("sharedFileReceived", handleSharedFile);
    };
  }, [handleSharedFile, processSharedFile]);
}
