"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Switch from "@/components/ui/switch";
import { TranscriptSegment, SpeakerLabels } from "@/lib/transcript/types";
import { useState } from "react";
import { useSettings } from "@/lib/state/settings";

type Props = {
  segments: TranscriptSegment[];
  labels: SpeakerLabels;
};

export default function TranscriptExportPanel({ segments, labels }: Props) {
  const [withTimestamps, setWithTimestamps] = useState(true);
  const [withSections, setWithSections] = useState(false);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  const download = () => {
    const md = buildMarkdown(
      segments,
      labels,
      { withTimestamps, withSections },
      { meetingTitle: settings.meetingTitle, meetingDate: settings.meetingDate, meetingParticipants: settings.meetingParticipants }
    );
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minutes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWithSummary = async () => {
    try {
      setLoading(true);
      const fullText = segments.map((s) => s.text).join("\n");
      const summary = await buildSummary(fullText, settings);
      const md = [
        summary.trim(),
        "",
        buildMarkdown(
          segments,
          labels,
          { withTimestamps, withSections },
          { meetingTitle: settings.meetingTitle, meetingDate: settings.meetingDate, meetingParticipants: settings.meetingParticipants }
        ),
      ].join("\n");
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `minutes-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Markdown出力（編集内容を反映）</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={download}>
            出力
          </Button>
          <Button onClick={downloadWithSummary} disabled={loading}>
            {loading ? "要約中…" : "要約付きで出力"}
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {settings.meetingTitle && `会議名: ${settings.meetingTitle} `}
        {settings.meetingDate && `／ 日付: ${settings.meetingDate} `}
        {settings.meetingParticipants && `／ 参加者: ${settings.meetingParticipants}`}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span>タイムスタンプ</span>
          <Switch checked={withTimestamps} onCheckedChange={setWithTimestamps} />
        </div>
        <div className="flex items-center gap-2">
          <span>セクション分割</span>
          <Switch checked={withSections} onCheckedChange={setWithSections} />
        </div>
      </div>
    </Card>
  );
}

async function buildSummary(text: string, settings: ReturnType<typeof useSettings>["settings"]) {
  const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
  if (!apiKey) throw new Error("APIキーが設定されていません");
  const res = await fetch("/api/llm/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "summary", provider: settings.apiProvider, apiKey, text, sourceLang: settings.language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || data?.error || "要約に失敗しました");
  return data.output as string;
}

function buildMarkdown(
  segments: TranscriptSegment[],
  labels: SpeakerLabels,
  opts: { withTimestamps: boolean; withSections: boolean },
  meta?: { meetingTitle?: string; meetingDate?: string; meetingParticipants?: string }
) {
  const lines: string[] = [];
  lines.push(`# 議事録`);
  const metaLines: string[] = [];
  if (meta?.meetingTitle) metaLines.push(`会議名: ${meta.meetingTitle}`);
  if (meta?.meetingDate) metaLines.push(`日付: ${meta.meetingDate}`);
  if (meta?.meetingParticipants) metaLines.push(`参加者: ${meta.meetingParticipants}`);
  if (metaLines.length) lines.push(metaLines.join(" ／ "));
  lines.push("");
  if (opts.withSections) {
    lines.push(`## 決定事項`);
    lines.push(`- `);
    lines.push("");
    lines.push(`## 次アクション（担当/期限）`);
    lines.push(`- `);
    lines.push("");
    lines.push(`## 議論`);
  } else {
    lines.push(`## 議論`);
  }

  for (const s of segments) {
    const label = s.speaker === "A" ? labels.A : labels.B;
    const ts = opts.withTimestamps ? `[${msToTimestamp(s.startMs ?? 0)}] ` : "";
    lines.push(`- ${ts}${label}: ${s.text}`);
  }
  lines.push("");
  return lines.join("\n");
}

function msToTimestamp(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
