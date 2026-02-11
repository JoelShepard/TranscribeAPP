export type Status =
  | "idle"
  | "recording"
  | "processing"
  | "transcribing"
  | "done"
  | "error";

export type ProcessingSource = "upload" | "recording";

export interface ResultMetadata {
  fileName: string;
  durationSeconds: number;
  source: ProcessingSource;
  transcriptionChars: number;
  wordCount: number;
  processedAt: string;
}
