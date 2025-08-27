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
import { useDictionary } from "@/lib/state/dictionary";
import { applyMappings } from "@/lib/dictionary/mapping";

type Props = {
  onAppend: (lines: string[], segments: TranscriptSegment[]) => void;
  onTranslate?: (text: string) => void;
};

export default function FileTranscribePanel({ onAppend, onTranslate }: Props) {
  const { settings } = useSettings();
  const { mappings } = useDictionary();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const toast = useToast();

  // 翻訳キュー（最大2並列、約250ms間隔）
  const queue: { items: string[]; inFlight: number; lastStart: number } = { items: [], inFlight: 0, lastStart: 0 };
  const maybeStartTranslate = async () => {
    if (!settings.translateEnabled || !onTranslate) return;
    const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
    if (!apiKey) return;
    const maxParallel = 2;
    while (queue.inFlight < maxParallel && queue.items.length > 0) {
      const since = Date.now() - queue.lastStart;
      const delay = since >= 250 ? 0 : 250 - since;
      const text = queue.items.shift()!;
      queue.inFlight++;
      setTimeout(async () => {
        queue.lastStart = Date.now();
        try {
          const res = await fetch("/api/llm/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task: "translate",
              provider: settings.apiProvider,
              apiKey,
              text,
              sourceLang: settings.language,
              targetLang: settings.targetLanguage,
              options: { translationFormality: settings.translationFormality },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.output) onTranslate?.(data.output);
        } catch {}
        queue.inFlight--;
        if (queue.items.length > 0) maybeStartTranslate();
      }, delay);
    }
  };
  const enqueueTranslations = (texts: string[]) => {
    if (!settings.translateEnabled || !onTranslate) return;
    for (const t of texts) {
      if (!t || !t.trim()) continue;
      const base = t.trim();
      const withDict = settings.translateUseDictionary && mappings?.length ? applyMappings(base, mappings) : base;
      queue.items.push(withDict);
    }
    // コレース: キューが膨らみすぎないよう古いものを間引く
    if (queue.items.length > 50) queue.items.splice(0, queue.items.length - 50);
    void maybeStartTranslate();
  };

  const onFile = async (file: File) => {
    if (!settings.sttEnabled) {
      setMsg("設定でSTT送信がOFFになっています");
      return;
    }
    const hasKey = !!(settings.groqApiKey?.trim() || settings.openaiApiKey?.trim());
    if (!hasKey) {
      const m = "APIキーが設定されていません（設定 > OpenAI/Groq）";
      setMsg(m);
      toast.show(m, "error");
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
          const newSentences: string[] = [];
          const newSegs: TranscriptSegment[] = [];
          if (Array.isArray(res.segments) && res.segments.length > 0) {
            for (const [j, s] of res.segments.entries()) {
              const text = basicPunctuate(removeFillers(s.text || ""));
              if (!text) continue;
              const startMs = (i * chunkSec * 1000) + (typeof s.start === "number" ? Math.floor(s.start * 1000) : 0);
              const endMs = (i * chunkSec * 1000) + (typeof s.end === "number" ? Math.floor(s.end * 1000) : undefined as any);
              const seg = { id: `${Date.now()}-${i}-${j}`, text, speaker: ((segs.length + newSegs.length) % 2 ? "B" : "A"), startMs, endMs } as TranscriptSegment;
              newSegs.push(seg);
              newSentences.push(text);
            }
          } else {
            const text = basicPunctuate(removeFillers(res.text || ""));
            if (text) {
              const seg = { id: `${Date.now()}-${i}`, text, speaker: ((segs.length + newSegs.length) % 2 ? "B" : "A"), startMs: i * chunkSec * 1000 } as TranscriptSegment;
              newSegs.push(seg);
              newSentences.push(text);
            }
          }
          // 即時反映（インクリメンタル）
          if (newSentences.length || newSegs.length) {
            sentences.push(...newSentences);
            segs.push(...newSegs);
            onAppend(newSentences, newSegs);
            enqueueTranslations(newSentences);
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
          // 逐次反映は不要（単発）
        } else {
          sentences = splitTextToSentences(text);
          const now = Date.now();
          segs = sentences.map((t, i) => ({
            id: `${now}-${i}`,
            text: t,
            speaker: i % 2 === 0 ? "A" : "B",
            startMs: i * 2000,
          }));
        }
        setProgress(100);
        onAppend(sentences, segs);
        enqueueTranslations(sentences);
        // ここでは onAppend 済みのため return して二重追加を回避
        const doneMsg = `取り込み完了: ${sentences.length} 文`;
        setMsg(doneMsg);
        toast.show(doneMsg, "success");
        return;
      }
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">音声ファイル取り込み（mp3/wav/m4a/webm）</div>
        <div className="text-xs text-muted-foreground">一括文字起こし</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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
