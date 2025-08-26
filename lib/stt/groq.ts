import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";

// Note: endpoint modeled after OpenAI-compatible audio API.
// Adjust base URL/headers per Groq's latest docs when wiring up.
const GROQ_BASE = "https://api.groq.com/openai/v1";

export class GroqSTT implements STTClient {
  name = "groq" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "whisper-large-v3") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribeBlob(blob: Blob, opts: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", blob, makeFilename(blob.type));
    form.append("model", this.model);
    // Prefer structured response if provider supports it
    form.append("response_format", "verbose_json");
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);
    if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));

    const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq STT error: ${res.status} ${errText}`);
    }
    const data = await res.json();
    // verbose_json may include { text, segments: [{id,start,end,text}] }
    const text: string = data.text ?? "";
    const segments = Array.isArray(data.segments)
      ? data.segments.map((s: any) => ({ text: s.text ?? "", start: s.start, end: s.end }))
      : [{ text }];
    return { text, segments };
  }
}

function makeFilename(mime: string) {
  const ts = Date.now();
  if (mime.includes("webm")) return `chunk-${ts}.webm`;
  if (mime.includes("ogg")) return `chunk-${ts}.ogg`;
  if (mime.includes("mp4")) return `chunk-${ts}.m4a`;
  if (mime.includes("mpeg")) return `chunk-${ts}.mp3`;
  if (mime.includes("wav")) return `chunk-${ts}.wav`;
  return `chunk-${ts}.webm`;
}
