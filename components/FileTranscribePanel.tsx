"use client";
import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSettings } from "@/lib/state/settings";
import { STTOrchestrator } from "@/lib/stt";
import { removeFillers, basicPunctuate } from "@/lib/processing/text";
import { splitTextToSentences, autoClusterAB } from "@/lib/processing/segment";
import type { TranscriptSegment } from "@/lib/transcript/types";
import { encodeWavMono, downmixToMono } from "@/lib/audio/wav";
import { useToast } from "@/lib/state/toast";

type Props = {
  onAppend: (lines: string[], segments: TranscriptSegment[]) => void;
};

export default function FileTranscribePanel({ onAppend }: Props) {
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const toast = useToast();

  const onFile = async (file: File) => {
    if (!settings.sttEnabled) {
      setMsg("設定でSTT送信がOFFになっています");
      return;
    }
    setBusy(true);
    setMsg("");
    setProgress(0);
    try {
      const stt = new STTOrchestrator({
        prefer: settings.apiProvider,
        groqApiKey: settings.groqApiKey,
        openaiApiKey: settings.openaiApiKey,
        viaProxy: settings.sttViaProxy,
      });
      let sentences: string[] = [];
      let segs: TranscriptSegment[] = [];
      if (settings.chunkImportEnabled) {
        // Decode and chunk with WebAudio
        const ab = await file.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuf = await ctx.decodeAudioData(ab.slice(0));
        const sr = audioBuf.sampleRate;
        const chs = audioBuf.numberOfChannels;
        const buffers: Float32Array[] = [];
        for (let ch = 0; ch < chs; ch++) buffers.push(audioBuf.getChannelData(ch));
        const mono = downmixToMono(buffers);
        const chunkSec = Math.max(5, Math.min(120, settings.chunkSeconds));
        const samplesPerChunk = Math.floor(sr * chunkSec);
        const totalChunks = Math.ceil(mono.length / samplesPerChunk);
        const concurrency = 2;
        let completed = 0;
        async function processIndex(i: number) {
          const start = i * samplesPerChunk;
          const end = Math.min(mono.length, start + samplesPerChunk);
          const slice = mono.subarray(start, end);
          const wav = encodeWavMono(slice, sr);
          const res = await stt.transcribe(wav as any as Blob, { language: settings.language });
          if (Array.isArray(res.segments) && res.segments.length > 0) {
            for (const [j, s] of res.segments.entries()) {
              const text = basicPunctuate(removeFillers(s.text || ""));
              if (!text) continue;
              const startMs = (i * chunkSec * 1000) + (typeof s.start === "number" ? Math.floor(s.start * 1000) : 0);
              const endMs = (i * chunkSec * 1000) + (typeof s.end === "number" ? Math.floor(s.end * 1000) : undefined as any);
              segs.push({ id: `${Date.now()}-${i}-${j}`, text, speaker: (segs.length % 2 ? "B" : "A"), startMs, endMs });
              sentences.push(text);
            }
          } else {
            const text = basicPunctuate(removeFillers(res.text || ""));
            if (text) {
              segs.push({ id: `${Date.now()}-${i}`, text, speaker: (segs.length % 2 ? "B" : "A"), startMs: i * chunkSec * 1000 });
              sentences.push(text);
            }
          }
          completed++;
          setProgress(Math.round((completed / totalChunks) * 100));
        }
        const indices = Array.from({ length: totalChunks }, (_, i) => i);
        let ptr = 0;
        const workers: Promise<void>[] = [];
        for (let k = 0; k < Math.min(concurrency, indices.length); k++) {
          workers.push((async function run() {
            while (ptr < indices.length) {
              const i = ptr++;
              await processIndex(i);
            }
          })());
        }
        await Promise.all(workers);
        // After building, auto-cluster by time gaps
        segs = autoClusterAB(segs, settings.vadSilenceTurnMs);
      } else {
        const res = await stt.transcribe(file, { language: settings.language });
        const text = basicPunctuate(removeFillers(res.text || ""));
        if (Array.isArray(res.segments) && res.segments.length > 0) {
          segs = res.segments
            .filter((s) => !!(s.text && s.text.trim()))
            .map((s, i) => ({
              id: `${Date.now()}-${i}`,
              text: basicPunctuate(removeFillers(s.text)),
              speaker: i % 2 === 0 ? "A" : "B",
              startMs: typeof s.start === "number" ? Math.max(0, Math.floor(s.start * 1000)) : i * 2000,
              endMs: typeof s.end === "number" ? Math.max(0, Math.floor(s.end * 1000)) : undefined,
            }));
          sentences = segs.map((s) => s.text);
          segs = autoClusterAB(segs, settings.vadSilenceTurnMs);
        } else {
          sentences = splitTextToSentences(text);
          const now = Date.now();
          segs = sentences.map((t, i) => ({
            id: `${now}-${i}`,
            text: t,
            speaker: i % 2 === 0 ? "A" : "B",
            startMs: i * 2000,
          }));
          segs = autoClusterAB(segs, settings.vadSilenceTurnMs);
        }
        setProgress(100);
      }
      onAppend(sentences, segs);
      const doneMsg = `取り込み完了: ${sentences.length} 文`;
      setMsg(doneMsg);
      toast.show(doneMsg, "success");
    } catch (e: any) {
      const errMsg = `エラー: ${e?.message || e}`;
      setMsg(errMsg);
      toast.show(errMsg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">音声ファイル取り込み（mp3/wav/m4a/webm）</div>
        <div className="text-xs text-muted-foreground">一括文字起こし</div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.webm"
          onChange={(e) => e.target.files && onFile(e.target.files[0])}
          disabled={busy}
        />
        {busy && <span className="text-xs text-muted-foreground">処理中…</span>}
      </div>
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-muted rounded h-2 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
      {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
    </Card>
  );
}
