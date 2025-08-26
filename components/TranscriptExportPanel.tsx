"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Switch from "@/components/ui/switch";
import { TranscriptSegment, SpeakerLabels } from "@/lib/transcript/types";
import { useState } from "react";
import { useSettings } from "@/lib/state/settings";
import { fetchJsonWithRetry } from "@/lib/utils";

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
      { withTimestamps, withSections, includeHeader: true, headings: settings.summaryTitles },
      { meetingTitle: settings.meetingTitle, meetingDate: settings.meetingDate, meetingParticipants: settings.meetingParticipants },
      undefined
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
      const header = buildHeader({ meetingTitle: settings.meetingTitle, meetingDate: settings.meetingDate, meetingParticipants: settings.meetingParticipants });
      const parsed = parseSummarySections(summary || "", settings.summaryTitles);
      const md = [
        header,
        "",
        "## 要約",
        "",
        (summary || "").trim(),
        "",
        "---",
        "",
        buildMarkdown(
          segments,
          labels,
          { withTimestamps, withSections, includeHeader: false, headings: settings.summaryTitles },
          undefined,
          parsed
        ),
      ].filter(Boolean).join("\n");
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">Markdown出力（編集内容を反映）</div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={download}>
            出力
          </Button>
          <Button onClick={downloadWithSummary} disabled={loading}>
            {loading ? "要約中…" : "要約付きで出力"}
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground break-words">
        {settings.meetingTitle && `会議名: ${settings.meetingTitle} `}
        {settings.meetingDate && `／ 日付: ${settings.meetingDate} `}
        {settings.meetingParticipants && `／ 参加者: ${settings.meetingParticipants}`}
      </div>
      <div className="flex items-center gap-3 text-sm flex-wrap">
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
      const { json } = await fetchJsonWithRetry<{ output?: string }>(
        "/api/llm/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "summary",
            provider: settings.apiProvider,
            apiKey,
            text,
            sourceLang: settings.language,
            options: {
              summaryDetail: settings.summaryDetail,
              includeTLDR: settings.summaryIncludeTLDR,
              includeDecisions: settings.summaryIncludeDecisions,
              includeDiscussion: settings.summaryIncludeDiscussion,
              includeRisks: settings.summaryIncludeRisks,
              includeIssues: settings.summaryIncludeIssues,
              includeNextActions: settings.summaryIncludeNextActions,
              summaryOrder: settings.summaryOrder,
            },
          }),
        },
        2,
        400
  );
  return (json?.output || "") as string;
}

function buildHeader(meta?: { meetingTitle?: string; meetingDate?: string; meetingParticipants?: string }) {
  const lines: string[] = [];
  const title = meta?.meetingTitle?.trim() || "議事録";
  lines.push(`# ${title}`);
  const metaParts: string[] = [];
  if (meta?.meetingDate) metaParts.push(`日付: ${meta.meetingDate}`);
  if (meta?.meetingParticipants) metaParts.push(`参加者: ${meta.meetingParticipants}`);
  if (metaParts.length) lines.push(metaParts.join(" ／ "));
  return lines.join("\n");
}

type SummaryTitles = { tldr: string; decisions: string; discussion: string; risks: string; issues: string; next: string };

function buildMarkdown(
  segments: TranscriptSegment[],
  labels: SpeakerLabels,
  opts: { withTimestamps: boolean; withSections: boolean; includeHeader?: boolean; headings?: SummaryTitles },
  meta?: { meetingTitle?: string; meetingDate?: string; meetingParticipants?: string },
  sectionContent?: { decisions?: string[]; next?: string[]; discussion?: string[]; risks?: string[]; issues?: string[]; tldr?: string[] }
) {
  const lines: string[] = [];
  if (opts.includeHeader !== false) {
    lines.push(buildHeader(meta));
    lines.push("");
  }
  const heads = opts.headings || { tldr: "概要", decisions: "決定事項", discussion: "論点と結論", risks: "リスク", issues: "課題", next: "次アクション（担当/期限）" };
  if (opts.withSections) {
    lines.push(`## ${heads.decisions}`);
    if (sectionContent?.decisions?.length) sectionContent.decisions.forEach((d) => lines.push(`- ${d}`)); else lines.push(`- `);
    lines.push("");
    lines.push(`## ${heads.next}`);
    if (sectionContent?.next?.length) sectionContent.next.forEach((d) => lines.push(`- ${d}`)); else lines.push(`- `);
    lines.push("");
    lines.push(`## ${heads.discussion}`);
  } else {
    lines.push(`## ${heads.discussion}`);
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

function parseSummarySections(summary: string, titles: SummaryTitles) {
  const lines = summary.split(/\r?\n/);
  const map: Record<string, string[]> = { tldr: [], decisions: [], discussion: [], risks: [], issues: [], next: [] };
  let cur: keyof typeof map | null = null;
  const titleToKey: Array<{ re: RegExp; key: keyof typeof map }> = [
    { re: new RegExp(`^##\s*${escapeRe(titles.tldr)}\s*$`), key: "tldr" },
    { re: new RegExp(`^##\s*${escapeRe(titles.decisions)}\s*$`), key: "decisions" },
    { re: new RegExp(`^##\s*${escapeRe(titles.discussion)}\s*$`), key: "discussion" },
    { re: new RegExp(`^##\s*${escapeRe(titles.risks)}\s*$`), key: "risks" },
    { re: new RegExp(`^##\s*${escapeRe(titles.issues)}\s*$`), key: "issues" },
    { re: new RegExp(`^##\s*${escapeRe(titles.next)}\s*$`), key: "next" },
  ];
  for (const raw of lines) {
    const line = raw.trim();
    const hit = titleToKey.find((t) => t.re.test(line));
    if (hit) {
      cur = hit.key;
      continue;
    }
    if (cur && line.startsWith("- ")) map[cur].push(line.slice(2).trim());
  }
  return map;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
