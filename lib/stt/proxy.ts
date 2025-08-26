import { STTClient, STTProvider, TranscriptionOptions, TranscriptionResult } from "./types";
import { blobToWavMono } from "@/lib/audio/wav";

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
    const send = async (b: Blob) => {
      // Normalize to File so that multipart part has a concrete Content-Type
      const t = (b.type || "").toLowerCase();
      const name = makeFilename(t);
      const file = new File([b], name, { type: t || guessMimeFromName(name) });
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("provider", this.name);
      form.append("apiKey", this.apiKey);
      if (this.model) form.append("model", this.model);
      if (opts.language) form.append("language", opts.language);
      if (opts.prompt) form.append("prompt", opts.prompt);
      if (typeof opts.temperature === "number") form.append("temperature", String(opts.temperature));
      const res = await fetch("/api/stt/transcribe", { method: "POST", body: form });
      return res;
    };

    let res = await send(blob);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 502 && /Invalid file format|could not process file/i.test(t)) {
        try {
          const wav = await blobToWavMono(blob);
          res = await send(new Blob([wav], { type: "audio/wav" }));
        } catch {}
      }
      if (!res.ok) throw new Error(`STT proxy error: ${res.status} ${t}`);
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

function guessMimeFromName(name: string) {
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".webm")) return "audio/webm";
  return "application/octet-stream";
}
