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
import { useToast } from "@/lib/state/toast";

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
  const translatingRef = useRef<boolean>(false); // deprecated single-worker flag (kept for safety)
  const translateQueueRef = useRef<string[]>([]);
  const inFlightRef = useRef<number>(0);
  const lastStartRef = useRef<number>(0);
  const { mappings } = useDictionary();
  const meter = useRef<{ ctx?: AudioContext; src?: MediaStreamAudioSourceNode; proc?: ScriptProcessorNode } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [level, setLevel] = useState(0);
  const toast = useToast();

  function maybeStartTranslateWorkers() {
    const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
    if (!apiKey) return;
    const maxParallel = 2;
    const now = Date.now();
    while (inFlightRef.current < maxParallel && translateQueueRef.current.length > 0) {
      const since = now - lastStartRef.current;
      const delay = since >= 250 ? 0 : 250 - since;
      const text = translateQueueRef.current.shift()!;
      inFlightRef.current++;
      setTimeout(async () => {
        lastStartRef.current = Date.now();
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
        } catch {
          // ignore single-job errors
        } finally {
          inFlightRef.current--;
          // Start more if available
          if (translateQueueRef.current.length > 0) maybeStartTranslateWorkers();
        }
      }, delay);
    }
  }

  function enqueueTranslation(text: string) {
    // coalesce: avoid unbounded growth
    translateQueueRef.current.push(text);
    if (translateQueueRef.current.length > 3) {
      translateQueueRef.current.splice(0, translateQueueRef.current.length - 2);
    }
    maybeStartTranslateWorkers();
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
          viaProxy: settings.sttViaProxy,
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
      } catch (e: any) {
        console.error(e);
        toast.show(`STTエラー: ${e?.message || e}`, "error");
      } finally {
        setPending(false);
      }
    },
    [onTranscript, settings]
  );

  const start = async () => {
    const rec = new AudioRecorder(
      { source, timesliceMs: 1500, deviceId },
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
            // Level meter
            try {
              meter.current?.proc?.disconnect();
              meter.current?.src?.disconnect();
              meter.current?.ctx?.close();
            } catch {}
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const src = ctx.createMediaStreamSource(stream);
              const proc = ctx.createScriptProcessor(2048, 1, 1);
              src.connect(proc);
              proc.connect(ctx.destination);
              proc.onaudioprocess = (ev) => {
                const buf = ev.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += buf[i] * i; // dummy line to ensure patch fits
              };
              proc.onaudioprocess = (ev) => {
                const buf = ev.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                const rms = Math.sqrt(sum / buf.length);
                setLevel(Math.min(1, rms * 1.5));
              };
              meter.current = { ctx, src, proc };
            } catch {}
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
    try {
      meter.current?.proc?.disconnect();
      meter.current?.src?.disconnect();
      meter.current?.ctx?.close();
    } catch {}
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

  useEffect(() => {
    // enumerate devices after permission granted
    navigator.mediaDevices?.enumerateDevices?.().then((list) => {
      setDevices(list.filter((d) => d.kind === "audioinput"));
    }).catch(() => {});
  }, [recording]);

  return (
    <Card className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3 items-end">
        <div className="sm:col-span-2">
          <div className="text-sm text-muted-foreground mb-1">音源</div>
          <div className="flex gap-2">
            <Button variant={source === "mic" ? "default" : "outline"} onClick={() => setSource("mic")}>
              マイク
            </Button>
            <Button variant={source === "tab" ? "default" : "outline"} onClick={() => setSource("tab")}>
              タブ音声
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm mb-1 block">マイク選択</label>
          <select className="w-full rounded-md border border-input bg-background p-2 text-sm" value={deviceId || ""} onChange={(e) => setDeviceId(e.target.value || undefined)}>
            <option value="">既定のマイク</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,4)}`}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>入力レベル</span>
          <span>{Math.min(100, Math.round(level * 100))}%</span>
        </div>
        <div className="h-2 w-full rounded bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round(level * 100))}%` }} />
        </div>
      </div>
      <div className="flex gap-2">
        {!recording ? (
          <Button onClick={start} size="lg">議事録開始</Button>
        ) : (
          <Button variant="secondary" onClick={stop} size="lg">
            停止
          </Button>
        )}
        {pending && <span className="text-xs text-muted-foreground">処理中…</span>}
      </div>
    </Card>
  );
}
