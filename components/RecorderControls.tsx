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
import { startPCMChunker } from "@/lib/audio/pcm";

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

  const sttQueueRef = useRef<Blob[]>([]);
  const sttActiveRef = useRef<number>(0);
  const STT_MAX_PARALLEL = 2;
  const recordingActiveRef = useRef<boolean>(false);

  const processSttQueue = useCallback(() => {
    if (!settings.sttEnabled) {
      sttQueueRef.current = [];
      return;
    }
    const hasKey = !!(settings.groqApiKey?.trim() || settings.openaiApiKey?.trim());
    if (!hasKey) {
      // キー未設定時は処理を止めて案内
      sttQueueRef.current = [];
      setPending(false);
      toast.show("APIキーが設定されていません（設定 > OpenAI/Groq）", "error");
      return;
    }
    // spawn workers up to max parallel
    while (sttActiveRef.current < STT_MAX_PARALLEL && sttQueueRef.current.length > 0) {
      const blob = sttQueueRef.current.shift()!;
      sttActiveRef.current++;
      setPending(true);
      (async () => {
        try {
          const stt = new STTOrchestrator({
            prefer: settings.apiProvider,
            groqApiKey: settings.groqApiKey,
            openaiApiKey: settings.openaiApiKey,
            viaProxy: settings.sttViaProxy,
          });
          let toSend = blob;
          if (settings.sttForceWav) {
            try {
              const wav = await (await import("@/lib/audio/wav")).blobToWavMono(blob);
              toSend = wav;
            } catch (e) {
              console.warn("WAV変換に失敗しました。元データを送信します", e);
            }
          }
          // Do not proceed if recording has been stopped
          if (!recordingActiveRef.current) return;
          const res = await stt.transcribe(toSend, { language: settings.language });
          if (!recordingActiveRef.current) return;
          const now = Date.now();
          const sessionStart = startTime.current ?? now;
          if (startTime.current === null) startTime.current = now;
          if (Array.isArray(res.segments) && res.segments.length > 0) {
            for (const s of res.segments) {
              const piece = basicPunctuate(removeFillers(s.text || ""));
              if (!piece) continue;
              if (!recordingActiveRef.current) break;
              onTranscript(piece);
              const spk = lastSpeaker.current;
              const startMs = typeof s.start === "number" ? Math.max(0, Math.floor(s.start * 1000)) : (Date.now() - sessionStart);
              const endMs = typeof s.end === "number" ? Math.max(0, Math.floor(s.end * 1000)) : undefined;
              onSegment?.({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: piece, speaker: spk, startMs, endMs });
            }
          } else {
            const cleaned = basicPunctuate(removeFillers(res.text || ""));
            if (cleaned) {
              if (!recordingActiveRef.current) return;
              onTranscript(cleaned);
              const spk = lastSpeaker.current;
              onSegment?.({ id: `${now}`, text: cleaned, speaker: spk, startMs: now - sessionStart });
            }
          }
          if (settings.translateEnabled && onTranslate) {
            const joined = Array.isArray(res.segments) && res.segments.length > 0 ? res.segments.map((s) => s.text).join(" ") : (res.text || "");
            const baseText = basicPunctuate(removeFillers(joined));
            if (baseText) {
              const t = settings.translateUseDictionary && mappings?.length ? applyMappings(baseText, mappings) : baseText;
              if (recordingActiveRef.current) enqueueTranslation(t);
            }
          }
        } catch (e: any) {
          console.error(e);
          toast.show(`STTエラー: ${e?.message || e}`, "error");
        } finally {
          sttActiveRef.current--;
          if (sttActiveRef.current <= 0 && sttQueueRef.current.length === 0) setPending(false);
          // try to start next if pending
          if (sttQueueRef.current.length > 0) processSttQueue();
        }
      })();
    }
  }, [settings, onTranscript]);

  const aggPartsRef = useRef<Blob[]>([]);
  const aggBytesRef = useRef<number>(0);
  const aggTypeRef = useRef<string>("");
  const aggTimerRef = useRef<number | null>(null);
  const MIN_SEND_BYTES = 4096; // 4KB 目安（早めに送る）
  const MAX_WAIT_MS = 300; // 最大待機を短縮（リアルタイム性重視）

  const flushAggregate = useCallback(() => {
    if (aggPartsRef.current.length === 0) return;
    const type = aggTypeRef.current || "audio/webm";
    const merged = new Blob(aggPartsRef.current, { type });
    aggPartsRef.current = [];
    aggBytesRef.current = 0;
    aggTypeRef.current = "";
    if (aggTimerRef.current) {
      clearTimeout(aggTimerRef.current);
      aggTimerRef.current = null;
    }
    // 最新優先で最大6件まで保持（古いものは間引き）
    sttQueueRef.current.push(merged);
    if (sttQueueRef.current.length > 6) sttQueueRef.current.splice(0, sttQueueRef.current.length - 6);
    processSttQueue();
  }, [processSttQueue]);

  const onChunk = useCallback((blob: Blob) => {
    if (!settings.sttEnabled) return;
    if (!blob || blob.size === 0) return;
    // 小さなチャンクは一旦合成してから送る
    if (blob.size < MIN_SEND_BYTES) {
      aggPartsRef.current.push(blob);
      aggBytesRef.current += blob.size;
      aggTypeRef.current = blob.type || aggTypeRef.current;
      if (!aggTimerRef.current) {
        aggTimerRef.current = window.setTimeout(() => {
          flushAggregate();
        }, MAX_WAIT_MS) as unknown as number;
      }
      if (aggBytesRef.current >= MIN_SEND_BYTES) flushAggregate();
      return;
    }
    // 十分なサイズなら即送信
    sttQueueRef.current.push(blob);
    if (sttQueueRef.current.length > 6) sttQueueRef.current.splice(0, sttQueueRef.current.length - 6);
    processSttQueue();
  }, [settings.sttEnabled, processSttQueue, flushAggregate]);

  const start = async () => {
    const rec = new AudioRecorder(
      { source, timesliceMs: Math.max(500, Math.min(5000, Math.round(settings.liveChunkSeconds * 1000))), deviceId },
      {
        onChunk: settings.livePcmWavMode ? undefined : onChunk,
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
            // PCM→WAV ライブモード
            if (settings.livePcmWavMode) {
              try {
                const pcm = await startPCMChunker(stream, {
                  chunkMs: Math.max(500, Math.min(5000, Math.round(settings.liveChunkSeconds * 1000))),
                  onChunk: (b) => onChunk(b),
                });
                (vadRef.current as any).pcm = pcm;
              } catch (e) {
                console.error("PCM chunker start failed", e);
                toast.show("PCMモード開始に失敗しました", "error");
              }
            }
          })();
        },
      }
    );
    recRef.current = rec;
    await rec.start();
    startTime.current = null;
    setRecording(true);
    recordingActiveRef.current = true;
    onRecordingChange?.(true);
  };

  const stop = () => {
    recRef.current?.stop();
    vadRef.current?.stop();
    try { (vadRef.current as any)?.pcm?.stop?.(); } catch {}
    // 残った小チャンクは破棄（誤検出抑止）
    try {
      aggPartsRef.current = [];
      aggBytesRef.current = 0;
      aggTypeRef.current = "";
      if (aggTimerRef.current) { clearTimeout(aggTimerRef.current); aggTimerRef.current = null; }
    } catch {}
    // STT/翻訳キューも破棄
    sttQueueRef.current = [];
    translateQueueRef.current = [];
    try {
      meter.current?.proc?.disconnect();
      meter.current?.src?.disconnect();
      meter.current?.ctx?.close();
    } catch {}
    setRecording(false);
    recordingActiveRef.current = false;
    setPending(false);
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
