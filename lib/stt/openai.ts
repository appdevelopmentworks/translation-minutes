import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";

const OPENAI_BASE = "https://api.openai.com/v1";

export class OpenAIWhisper implements STTClient {
  name = "openai" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "whisper-1") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribeBlob(blob: Blob, opts: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", blob, `chunk-${Date.now()}.webm`);
    form.append("model", this.model);
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);
    if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));

    const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI STT error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text: string = data.text ?? "";
    return { text, segments: [{ text }] };
  }
}

