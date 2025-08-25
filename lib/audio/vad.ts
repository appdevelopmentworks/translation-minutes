"use client";

type VADHandlers = {
  onSpeechStart?: (tMs: number) => void;
  onSpeechEnd?: (tMs: number) => void;
  onError?: (e: unknown) => void;
};

export type VADOptions = {
  sampleRate?: number; // inferred from stream if not provided
  frameSize?: number; // samples per frame (e.g., 2048)
  thresholdDb?: number; // speech threshold above noise floor in dB
  hangoverMs?: number; // keep speaking for this time after drop
};

export class VAD {
  private ctx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private proc?: ScriptProcessorNode;
  private handlers: VADHandlers;
  private options: Required<VADOptions>;
  private speaking = false;
  private lastChange = 0;
  private base = 0;
  private noiseDb = -100; // adaptive noise floor

  constructor(stream: MediaStream, handlers: VADHandlers = {}, opts: VADOptions = {}) {
    this.handlers = handlers;
    this.options = {
      sampleRate: 48000,
      frameSize: 2048,
      thresholdDb: opts.thresholdDb ?? 12,
      hangoverMs: opts.hangoverMs ?? 200,
      ...opts,
    } as Required<VADOptions>;
    this.base = performance.now();
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.source = this.ctx.createMediaStreamSource(stream);
    const frame = nearestPow2(this.options.frameSize);
    this.proc = this.ctx.createScriptProcessor(frame, 1, 1);
    this.source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
    this.proc.onaudioprocess = (ev) => {
      try {
        const buf = ev.inputBuffer.getChannelData(0);
        const rms = rootMeanSquare(buf);
        const db = 20 * Math.log10(rms + 1e-9);
        // adapt noise floor (slow rise, faster drop)
        const alpha = db < this.noiseDb ? 0.1 : 0.01;
        this.noiseDb = this.noiseDb * (1 - alpha) + db * alpha;
        const isSpeech = db > this.noiseDb + this.options.thresholdDb;
        const now = performance.now();
        if (!this.speaking && isSpeech) {
          this.speaking = true;
          this.lastChange = now;
          this.handlers.onSpeechStart?.(now - this.base);
        } else if (this.speaking && !isSpeech) {
          // hangover to avoid chattering
          if (now - this.lastChange > this.options.hangoverMs) {
            this.speaking = false;
            this.lastChange = now;
            this.handlers.onSpeechEnd?.(now - this.base);
          }
        }
      } catch (e) {
        this.handlers.onError?.(e);
      }
    };
  }

  setParams(params: { thresholdDb?: number; hangoverMs?: number }) {
    if (typeof params.thresholdDb === "number") this.options.thresholdDb = params.thresholdDb;
    if (typeof params.hangoverMs === "number") this.options.hangoverMs = params.hangoverMs;
  }

  stop() {
    try {
      this.proc?.disconnect();
      this.source?.disconnect();
      this.ctx?.close();
    } catch {}
  }
}

function rootMeanSquare(buf: Float32Array) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function nearestPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
