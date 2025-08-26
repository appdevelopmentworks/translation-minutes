"use client";
import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSettings } from "@/lib/state/settings";
import { useToast } from "@/lib/state/toast";
import { fetchJsonWithRetry } from "@/lib/utils";

export default function SummaryPanel({ fullText }: { fullText: string }) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const toast = useToast();

  const summarize = async () => {
    setLoading(true);
    try {
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
            text: fullText,
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
              summaryTitles: settings.summaryTitles,
            },
          }),
        },
      2,
      400
      );
      setSummary(json?.output || "");
      toast.show("要約が完了しました", "success");
    } catch (e: any) {
      setSummary(`エラー: ${e?.message || e}`);
      toast.show(`要約エラー: ${e?.message || e}` as string, "error");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    // ヘッダ（会議名/日付/参加者）を付けたMarkdownで出力
    const header = buildHeader({
      meetingTitle: settings.meetingTitle,
      meetingDate: settings.meetingDate,
      meetingParticipants: settings.meetingParticipants,
    });
    const body = summary ? ["## 要約", "", summary].join("\n") : fullText;
    const md = [header, "", body].filter(Boolean).join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minutes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">要約と出力</div>
        <div className="flex gap-2">
          <Button onClick={summarize} disabled={loading}>
            {loading ? "要約中…" : "要約"}
          </Button>
          <Button variant="outline" onClick={download}>
            Markdown出力
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground break-words">
        粒度: {settings.summaryDetail === "concise" ? "簡潔" : settings.summaryDetail === "detailed" ? "詳細" : "標準"} ／
        TL;DR: {settings.summaryIncludeTLDR ? "あり" : "なし"} ／
        項目: {[
          settings.summaryIncludeDecisions && "決定事項",
          settings.summaryIncludeDiscussion && "論点",
          settings.summaryIncludeRisks && "リスク",
          settings.summaryIncludeIssues && "課題",
          settings.summaryIncludeNextActions && "次アクション",
        ].filter(Boolean).join("・") || "なし"}
      </div>
      {summary && (
        <div className="space-y-2">
          <div className="text-sm font-medium">## 要約</div>
          <div className="h-px w-full bg-border" />
          <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm break-words">{summary}</pre>
        </div>
      )}
    </Card>
  );
}
