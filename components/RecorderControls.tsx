"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { AudioRecorder } from "@/lib/audio/recorder";
import { STTOrchestrator } from "@/lib/stt";
import { removeFillers, basicPunctuate } from "@/lib/processing/text";
import { useSettings } from "@/lib/state/settings";
import { TranscriptSegment } from "@/lib/transcript/types";
import { VAD } from "@/lib/audio/vad";
import { WorkletVAD } from "@/lib/audio/vadWorklet";
import { useDictionary } from "@/lib/state/dictionary";
import { applyMappings } from "@/lib/dictionary/mapping";

type Props = {
  onTranscript: (text: string) => void;
  onSegment?: (seg: TranscriptSegment) => void;
  onTranslate?: (text: string) => void;
  onRecordingChange?: (recording: boolean) => void;
};

export default function RecorderControls({ onTranscript, onSegment, onTranslate, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [source, setSource] = useState<"mic" | "tab">("mic");
  const [pending, setPending] = useState(false);
  const recRef = useRef<AudioRecorder | null>(null);
  const { settings } = useSettings();
  const lastSpeaker = useRef<"A" | "B">("A");
  const startTime = useRef<number | null>(null);
  const vadRef = useRef<{ stop: () => void; update?: (p: { thresholdDb?: number; hangoverMs?: number }) => void; setParams?: (p: { thresholdDb?: number; hangoverMs?: number }) => void } | null>(null);
  const lastSpeechEnd = useRef<number>(0);
  const translatingRef = useRef<boolean>(false);
  const translateQueueRef = useRef<string[]>([]);
  const { mappings } = useDictionary();

  async function processTranslateQueue() {
    if (translatingRef.current) return;
    const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
    if (!apiKey) return;
    translatingRef.current = true;
    try {
      while (translateQueueRef.current.length > 0) {
        const text = translateQueueRef.current.shift()!;
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
        await new Promise((r) => setTimeout(r, 250)); // small pacing
      }
    } catch (e) {
      // swallow per-queue errors
    } finally {
      translatingRef.current = false;
      // If items arrived during processing end, loop again
      if (translateQueueRef.current.length > 0) processTranslateQueue();
    }
  }

  function enqueueTranslation(text: string) {
    // coalesce: avoid unbounded growth
    translateQueueRef.current.push(text);
    if (translateQueueRef.current.length > 3) {
      translateQueueRef.current.splice(0, translateQueueRef.current.length - 2);
    }
    processTranslateQueue();
  }

  const onChunk = useCallback(
    async (blob: Blob) => {
      if (!settings.sttEnabled) return;
      setPending(true);
      try {
        const stt = new STTOrchestrator({
          prefer: settings.apiProvider,
          groqApiKey: settings.groqApiKey,
          openaiApiKey: settings.openaiApiKey,
        });
        const res = await stt.transcribe(blob, { language: settings.language });
        const now = Date.now();
        const sessionStart = startTime.current ?? now;
        if (startTime.current === null) startTime.current = now;
        if (Array.isArray(res.segments) && res.segments.length > 0) {
          for (const s of res.segments) {
            const piece = basicPunctuate(removeFillers(s.text || ""));
            if (!piece) continue;
            onTranscript(piece);
            const spk = lastSpeaker.current;
            const startMs = typeof s.start === "number" ? Math.max(0, Math.floor(s.start * 1000)) : (Date.now() - sessionStart);
            const endMs = typeof s.end === "number" ? Math.max(0, Math.floor(s.end * 1000)) : undefined;
            onSegment?.({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: piece, speaker: spk, startMs, endMs });
          }
        } else {
          const cleaned = basicPunctuate(removeFillers(res.text || ""));
          if (cleaned) {
            onTranscript(cleaned);
            const spk = lastSpeaker.current;
            onSegment?.({ id: `${now}`, text: cleaned, speaker: spk, startMs: now - sessionStart });
          }
        }
        // 逐次翻訳（設定が有効な場合）: キュー化して順次処理
        if (settings.translateEnabled && onTranslate) {
          const joined = Array.isArray(res.segments) && res.segments.length > 0 ? res.segments.map((s) => s.text).join(" ") : (res.text || "");
          const baseText = basicPunctuate(removeFillers(joined));
          if (baseText) {
            const t = settings.translateUseDictionary && mappings?.length ? applyMappings(baseText, mappings) : baseText;
            enqueueTranslation(t);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setPending(false);
      }
    },
    [onTranscript, settings]
  );

  const start = async () => {
    const rec = new AudioRecorder(
      { source, timesliceMs: 1500 },
      {
        onChunk,
        onMedia: (stream) => {
          // Start VAD on the same stream
          vadRef.current?.stop();
          (async () => {
            try {
              const w = new WorkletVAD(
                stream,
                {
                  onSpeechStart: (tMs) => {
                    if (tMs - lastSpeechEnd.current > settings.vadSilenceTurnMs) {
                      lastSpeaker.current = lastSpeaker.current === "A" ? "B" : "A";
                    }
                  },
                  onSpeechEnd: (tMs) => {
                    lastSpeechEnd.current = tMs;
                  },
                },
                { thresholdDb: settings.vadThresholdDb, hangoverMs: settings.vadHangoverMs }
              );
              await w.start();
              vadRef.current = w;
            } catch (e) {
              const s = new VAD(
                stream,
                {
                  onSpeechStart: (tMs) => {
                    if (tMs - lastSpeechEnd.current > settings.vadSilenceTurnMs) {
                      lastSpeaker.current = lastSpeaker.current === "A" ? "B" : "A";
                    }
                  },
                  onSpeechEnd: (tMs) => {
                    lastSpeechEnd.current = tMs;
                  },
                },
                { thresholdDb: settings.vadThresholdDb, hangoverMs: settings.vadHangoverMs }
              );
              vadRef.current = s;
            }
          })();
        },
      }
    );
    recRef.current = rec;
    await rec.start();
    startTime.current = null;
    setRecording(true);
    onRecordingChange?.(true);
  };

  const stop = () => {
    recRef.current?.stop();
    vadRef.current?.stop();
    setRecording(false);
    onRecordingChange?.(false);
  };

  useEffect(() => () => recRef.current?.stop(), []);

  // 動的にVADパラメータを反映（Worklet優先、なければScriptProcessor）
  useEffect(() => {
    const p = { thresholdDb: settings.vadThresholdDb, hangoverMs: settings.vadHangoverMs };
    if (vadRef.current?.update) vadRef.current.update(p);
    else if (vadRef.current?.setParams) vadRef.current.setParams(p);
  }, [settings.vadThresholdDb, settings.vadHangoverMs]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">音源</div>
        <div className="flex gap-2">
          <Button variant={source === "mic" ? "default" : "outline"} onClick={() => setSource("mic")}>
            マイク
          </Button>
          <Button variant={source === "tab" ? "default" : "outline"} onClick={() => setSource("tab")}>
            タブ音声
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        {!recording ? (
          <Button onClick={start}>議事録開始</Button>
        ) : (
          <Button variant="secondary" onClick={stop}>
            停止
          </Button>
        )}
        {pending && <span className="text-xs text-muted-foreground">処理中…</span>}
      </div>
    </Card>
  );
}
