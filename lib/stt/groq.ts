import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";
import { blobToWavMono } from "@/lib/audio/wav";

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
    const { file, filename } = normalizeBlobToFile(blob);
    form.append("file", file, filename);
    form.append("model", this.model);
    // Prefer structured response if provider supports it
    form.append("response_format", "verbose_json");
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);
    if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));

    let res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // If provider cannot parse the container, try WAV fallback once
      if (res.status === 400 && /could not process file|Invalid file format/i.test(errText)) {
        try {
          const wav = await blobToWavMono(blob);
          const wavFile = new File([wav], `chunk-${Date.now()}.wav`, { type: "audio/wav" });
          const form2 = new FormData();
          form2.append("file", wavFile, wavFile.name);
          form2.append("model", this.model);
          form2.append("response_format", "verbose_json");
          if (opts.language) form2.append("language", opts.language);
          if (opts.prompt) form2.append("prompt", opts.prompt);
          if (typeof opts.temperature === "number") form2.append("temperature", String(opts.temperature));
          res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: form2,
          });
        } catch {}
      }
      if (!res.ok) throw new Error(`Groq STT error: ${res.status} ${errText}`);
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

function normalizeBlobToFile(b: Blob) {
  const ts = Date.now();
  const t = (b.type || "").toLowerCase();
  if (t.includes("webm")) return { file: new File([b], `chunk-${ts}.webm`, { type: "audio/webm" }), filename: `chunk-${ts}.webm` };
  if (t.includes("ogg")) return { file: new File([b], `chunk-${ts}.ogg`, { type: "audio/ogg" }), filename: `chunk-${ts}.ogg` };
  if (t.includes("mpeg")) return { file: new File([b], `chunk-${ts}.mp3`, { type: "audio/mpeg" }), filename: `chunk-${ts}.mp3` };
  if (t.includes("wav")) return { file: new File([b], `chunk-${ts}.wav`, { type: "audio/wav" }), filename: `chunk-${ts}.wav` };
  if (t.includes("mp4")) return { file: new File([b], `chunk-${ts}.m4a`, { type: "audio/mp4" }), filename: `chunk-${ts}.m4a` };
  return { file: new File([b], `chunk-${ts}.webm`, { type: "audio/webm" }), filename: `chunk-${ts}.webm` };
}
