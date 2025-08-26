import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";
import { blobToWavMono } from "@/lib/audio/wav";

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
    const { file, filename } = normalizeBlobToFile(blob);
    form.append("file", file, filename);
    form.append("model", this.model);
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);
    if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));

    let res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 400 && /Invalid file format|could not process file/i.test(errText)) {
        try {
          const wav = await blobToWavMono(blob);
          const wavFile = new File([wav], `chunk-${Date.now()}.wav`, { type: "audio/wav" });
          const form2 = new FormData();
          form2.append("file", wavFile, wavFile.name);
          form2.append("model", this.model);
          if (opts.language) form2.append("language", opts.language);
          if (opts.prompt) form2.append("prompt", opts.prompt);
          if (typeof opts.temperature === "number") form2.append("temperature", String(opts.temperature));
          res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: form2,
          });
        } catch {}
      }
      if (!res.ok) throw new Error(`OpenAI STT error: ${res.status} ${errText}`);
    }
    const data = await res.json();
    const text: string = data.text ?? "";
    return { text, segments: [{ text }] };
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
  // type が空/不明なら webm で明示
  return { file: new File([b], `chunk-${ts}.webm`, { type: "audio/webm" }), filename: `chunk-${ts}.webm` };
}
