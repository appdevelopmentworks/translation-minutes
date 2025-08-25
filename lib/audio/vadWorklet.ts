"use client";

type Handlers = {
  onSpeechStart?: (tMs: number) => void;
  onSpeechEnd?: (tMs: number) => void;
  onError?: (e: unknown) => void;
};

export class WorkletVAD {
  private ctx?: AudioContext;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private base = 0;

  constructor(private stream: MediaStream, private handlers: Handlers, private opts: { thresholdDb: number; hangoverMs: number }) {}

  async start() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.base = performance.now();
      await this.ctx.audioWorklet.addModule("/worklets/vad-processor.js");
      this.node = new AudioWorkletNode(this.ctx, "vad-processor");
      this.node.port.onmessage = (e) => {
        const d = e.data || {};
        if (d.type === "speech_start") this.handlers.onSpeechStart?.(d.tMs - this.base);
        if (d.type === "speech_end") this.handlers.onSpeechEnd?.(d.tMs - this.base);
      };
      this.node.port.postMessage({ thresholdDb: this.opts.thresholdDb, hangoverMs: this.opts.hangoverMs });
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.source.connect(this.node);
      this.node.connect(this.ctx.destination);
    } catch (e) {
      this.handlers.onError?.(e);
      throw e;
    }
  }

  update(params: { thresholdDb?: number; hangoverMs?: number }) {
    try {
      this.node?.port.postMessage(params);
    } catch {}
  }

  stop() {
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.ctx?.close();
    } catch {}
  }
}
