export type STTProvider = "groq" | "openai";

export type TranscriptionOptions = {
  language?: string; // e.g., "ja"
  prompt?: string;
  temperature?: number;
};

export type TranscriptionSegment = {
  text: string;
  start?: number; // seconds
  end?: number; // seconds
  speaker?: string; // A/B
  provisional?: boolean;
};

export type TranscriptionResult = {
  segments: TranscriptionSegment[];
  text: string;
};

export interface STTClient {
  name: STTProvider;
  transcribeBlob(blob: Blob, opts?: TranscriptionOptions): Promise<TranscriptionResult>;
}

