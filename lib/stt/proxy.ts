import { STTClient, STTProvider, TranscriptionOptions, TranscriptionResult } from "./types";

export class ProxySTT implements STTClient {
  name: STTProvider;
  private apiKey: string;
  private model?: string;

  constructor(provider: STTProvider, apiKey: string, model?: string) {
    this.name = provider;
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribeBlob(blob: Blob, opts: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", blob, makeFilename(blob.type));
    form.append("provider", this.name);
    form.append("apiKey", this.apiKey);
    if (this.model) form.append("model", this.model);
    if (opts.language) form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt);
    if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));

    const res = await fetch("/api/stt/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`STT proxy error: ${res.status} ${t}`);
    }
    const data = await res.json();
    const text: string = data?.text ?? "";
    const segments = Array.isArray(data?.segments)
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
