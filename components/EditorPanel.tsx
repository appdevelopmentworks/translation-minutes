"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { InputHTMLAttributes, useState } from "react";
import { TranscriptSegment, Speaker, SpeakerLabels } from "@/lib/transcript/types";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/lib/state/audioPlayer";
import { autoClusterAB } from "@/lib/processing/segment";
import { useSettings } from "@/lib/state/settings";

type Props = {
  segments: TranscriptSegment[];
  setSegments: (s: TranscriptSegment[]) => void;
  speakerLabels: SpeakerLabels;
  setSpeakerLabels: (l: SpeakerLabels) => void;
};

export default function EditorPanel({ segments, setSegments, speakerLabels, setSpeakerLabels }: Props) {
  const labelA = speakerLabels.A;
  const labelB = speakerLabels.B;
  const { seekMs, hasAudio } = useAudioPlayer();
  const { settings } = useSettings();

  const setSpeaker = (id: string, speaker: Speaker) => {
    setSegments(
      segments.map((s) => (s.id === id ? { ...s, speaker } : s))
    );
  };

  const setText = (id: string, text: string) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const mergeWithPrev = (idx: number) => {
    if (idx <= 0) return;
    const prev = segments[idx - 1];
    const cur = segments[idx];
    const merged: TranscriptSegment = {
      ...prev,
      text: `${prev.text} ${cur.text}`.trim(),
      endMs: cur.endMs ?? prev.endMs,
    };
    const next = [...segments];
    next.splice(idx - 1, 2, merged);
    setSegments(next);
  };

  const reCluster = () => {
    const gap = settings.vadSilenceTurnMs;
    setSegments(autoClusterAB(segments, gap));
  };

  const assignAlternating = () => {
    let current: Speaker = "A";
    setSegments(
      segments.map((s) => {
        const out = { ...s, speaker: current } as TranscriptSegment;
        current = current === "A" ? "B" : "A";
        return out;
      })
    );
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">話者編集</div>
        <div className="flex gap-2 text-sm">
          <EditableLabel
            value={labelA}
            onChange={(v) => setSpeakerLabels({ ...speakerLabels, A: v })}
            className="px-2 py-1 rounded bg-muted"
          />
          <EditableLabel
            value={labelB}
            onChange={(v) => setSpeakerLabels({ ...speakerLabels, B: v })}
            className="px-2 py-1 rounded bg-muted"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={reCluster}>自動クラスタ（A/B）</Button>
        <Button size="sm" variant="outline" onClick={assignAlternating}>A/B交互割当</Button>
      </div>
      <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
        {segments.map((s, i) => (
          <div key={s.id} className="rounded border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={s.speaker === "A" ? "default" : "outline"}
                  onClick={() => setSpeaker(s.id, "A")}
                >
                  {labelA}
                </Button>
                <Button
                  size="sm"
                  variant={s.speaker === "B" ? "default" : "outline"}
                  onClick={() => setSpeaker(s.id, "B")}
                >
                  {labelB}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{msToTimestamp(s.startMs ?? 0)}</span>
                <Button size="sm" variant="outline" disabled={!hasAudio || !s.startMs} onClick={() => s.startMs && seekMs(s.startMs!)}>
                  ジャンプ
                </Button>
              </div>
            </div>
            <textarea
              value={s.text}
              onChange={(e) => setText(s.id, e.target.value)}
              className="mt-2 w-full resize-vertical rounded-md border border-input bg-background p-2 text-sm"
              rows={2}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => mergeWithPrev(i)} disabled={i === 0}>
                前と結合
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function msToTimestamp(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function EditableLabel({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {editing ? (
        <input
          className="bg-transparent outline-none text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onChange(val);
          }}
          autoFocus
        />
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm">
          {value}
        </button>
      )}
    </div>
  );
}
