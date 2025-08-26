import { NextRequest, NextResponse } from "next/server";

type Provider = "groq" | "openai";

const PROVIDERS: Record<Provider, { base: string; model: string; verbose: boolean }> = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3",
    verbose: true, // supports verbose_json
  },
  openai: {
    base: "https://api.openai.com/v1",
    model: "whisper-1",
    verbose: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const provider = (form.get("provider") as Provider) || "groq";
    const apiKey = String(form.get("apiKey") || "");
    if (!apiKey) return NextResponse.json({ error: "missing_api_key" }, { status: 400 });
    const cfg = PROVIDERS[provider];
    if (!cfg) return NextResponse.json({ error: "provider_not_supported" }, { status: 400 });

    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });
    const model = String(form.get("model") || cfg.model);
    const language = form.get("language") as string | null;
    const prompt = form.get("prompt") as string | null;
    const temperature = form.get("temperature") as string | null;

    // Rebuild provider form to avoid leaking extra keys
    const providerForm = new FormData();
    // Ensure filename extension matches mime for better provider compatibility
    const name = (file as any).name || suggestName((file as any).type || "");
    providerForm.append("file", file, name);
    providerForm.append("model", model);
    if (cfg.verbose) providerForm.append("response_format", "verbose_json");
    if (language) providerForm.append("language", language);
    if (prompt) providerForm.append("prompt", prompt);
    if (temperature) providerForm.append("temperature", temperature);

    const upstream = await fetch(`${cfg.base}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: providerForm,
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return NextResponse.json({ error: "upstream_error", detail: errText }, { status: 502 });
    }
    const data = await upstream.json();
    const text: string = data?.text ?? "";
    const segments = Array.isArray(data?.segments)
      ? data.segments.map((s: any) => ({ text: s.text ?? "", start: s.start, end: s.end }))
      : [{ text }];
    return NextResponse.json({ text, segments });
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", detail: String(e?.message || e) }, { status: 500 });
  }
}

function suggestName(mime: string) {
  const ts = Date.now();
  if (mime.includes("webm")) return `chunk-${ts}.webm`;
  if (mime.includes("ogg")) return `chunk-${ts}.ogg`;
  if (mime.includes("mp4")) return `chunk-${ts}.m4a`;
  if (mime.includes("mpeg")) return `chunk-${ts}.mp3`;
  if (mime.includes("wav")) return `chunk-${ts}.wav`;
  return `chunk-${ts}.webm`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
