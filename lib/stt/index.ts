import { STTClient, TranscriptionOptions, TranscriptionResult } from "./types";
import { GroqSTT } from "./groq";
import { OpenAIWhisper } from "./openai";

export type STTOrchestratorConfig = {
  groqApiKey?: string;
  openaiApiKey?: string;
  prefer: "groq" | "openai";
};

export class STTOrchestrator {
  private clients: STTClient[] = [];

  constructor(cfg: STTOrchestratorConfig) {
    if (cfg.prefer === "groq" && cfg.groqApiKey) this.clients.push(new GroqSTT(cfg.groqApiKey));
    if (cfg.prefer === "openai" && cfg.openaiApiKey) this.clients.push(new OpenAIWhisper(cfg.openaiApiKey));
    // Fallback order
    if (cfg.prefer === "groq" && cfg.openaiApiKey) this.clients.push(new OpenAIWhisper(cfg.openaiApiKey));
    if (cfg.prefer === "openai" && cfg.groqApiKey) this.clients.push(new GroqSTT(cfg.groqApiKey));
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

