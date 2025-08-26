import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";
import { GroqSTT } from "./groq";
import { OpenAIWhisper } from "./openai";
import { ProxySTT } from "./proxy";

export type STTOrchestratorConfig = {
  groqApiKey?: string;
  openaiApiKey?: string;
  prefer: "groq" | "openai";
  viaProxy?: boolean; // use Next.js route handler to avoid CORS
};

export class STTOrchestrator {
  private clients: STTClient[] = [];

  constructor(cfg: STTOrchestratorConfig) {
    const useProxy = cfg.viaProxy ?? (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_STT_VIA_PROXY === "1");
    if (useProxy) {
      if (cfg.prefer === "groq" && cfg.groqApiKey) this.clients.push(new ProxySTT("groq", cfg.groqApiKey));
      if (cfg.prefer === "openai" && cfg.openaiApiKey) this.clients.push(new ProxySTT("openai", cfg.openaiApiKey));
      if (cfg.prefer === "groq" && cfg.openaiApiKey) this.clients.push(new ProxySTT("openai", cfg.openaiApiKey));
      if (cfg.prefer === "openai" && cfg.groqApiKey) this.clients.push(new ProxySTT("groq", cfg.groqApiKey));
    } else {
      if (cfg.prefer === "groq" && cfg.groqApiKey) this.clients.push(new GroqSTT(cfg.groqApiKey));
      if (cfg.prefer === "openai" && cfg.openaiApiKey) this.clients.push(new OpenAIWhisper(cfg.openaiApiKey));
      // Fallback order
      if (cfg.prefer === "groq" && cfg.openaiApiKey) this.clients.push(new OpenAIWhisper(cfg.openaiApiKey));
      if (cfg.prefer === "openai" && cfg.groqApiKey) this.clients.push(new GroqSTT(cfg.groqApiKey));
    }
  }

  async transcribe(blob: Blob, opts?: TranscriptionOptions): Promise<TranscriptionResult> {
    let lastErr: unknown;
    for (const c of this.clients) {
      try {
        return await c.transcribeBlob(blob, opts);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("No STT client configured");
  }
}
