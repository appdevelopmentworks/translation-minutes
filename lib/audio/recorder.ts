"use client";
export type Source = "mic" | "tab";

export type RecorderOptions = {
  source: Source;
  timesliceMs?: number; // chunk size
  deviceId?: string; // mic device
};

export type RecorderHandlers = {
  onChunk?: (blob: Blob) => void;
  onStart?: () => void;
  onMedia?: (stream: MediaStream) => void;
  onStop?: () => void;
  onError?: (err: unknown) => void;
};

export class AudioRecorder {
  private media?: MediaStream;
  private recorder?: MediaRecorder;
  private options: RecorderOptions;
  private handlers: RecorderHandlers;

  constructor(options: RecorderOptions, handlers: RecorderHandlers = {}) {
    this.options = { timesliceMs: 1000, ...options };
    this.handlers = handlers;
  }

  async start() {
    try {
      if (this.options.source === "mic") {
        this.media = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: this.options.deviceId,
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
          video: false,
        });
      } else {
        // Browser will prompt to pick a tab. On Chrome you can include tab audio.
        this.media = await (navigator.mediaDevices as any).getDisplayMedia({
          audio: true,
          video: true,
        });
      }
      const stream = this.media as MediaStream;
      if (!stream) throw new Error("Media stream not available");
      this.handlers.onMedia?.(stream);
      const mimeType = getPreferredMimeType();
      this.recorder = new MediaRecorder(stream, { mimeType });
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.handlers.onChunk?.(e.data);
      };
      this.recorder.onstart = () => this.handlers.onStart?.();
      this.recorder.onstop = () => this.handlers.onStop?.();
      this.recorder.onerror = (e) => this.handlers.onError?.(e);
      this.recorder.start(this.options.timesliceMs);
    } catch (err) {
      this.handlers.onError?.(err);
      throw err;
    }
  }

  stop() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.media?.getTracks().forEach((t) => t.stop());
  }
}

function getPreferredMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];
  for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
  return "audio/webm";
}
