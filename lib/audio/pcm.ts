"use client";

import { encodeWavMono } from "@/lib/audio/wav";

export type PCMChunker = {
  stop: () => void;
};

export async function startPCMChunker(
  stream: MediaStream,
  opts: { chunkMs: number; onChunk: (blob: Blob) => void }
): Promise<PCMChunker> {
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const sampleRate = ctx.sampleRate;

  let buffer = new Float32Array(0);
  let lastFlush = performance.now();

  function append(data: Float32Array) {
    const tmp = new Float32Array(buffer.length + data.length);
    tmp.set(buffer, 0);
    tmp.set(data, buffer.length);
    buffer = tmp;
  }

  function flush() {
    if (buffer.length === 0) return;
    const wav = encodeWavMono(buffer, sampleRate);
    buffer = new Float32Array(0);
    opts.onChunk(wav);
  }

  processor.onaudioprocess = (ev) => {
    const ch0 = ev.inputBuffer.getChannelData(0);
    append(new Float32Array(ch0));
    const now = performance.now();
    if (now - lastFlush >= opts.chunkMs) {
      flush();
      lastFlush = now;
    }
  };
  src.connect(processor);
  processor.connect(ctx.destination);

  return {
    stop: () => {
      try { processor.disconnect(); } catch {}
      try { src.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    },
  };
}

