"use client";
import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSettings } from "@/lib/state/settings";

export default function SummaryPanel({ fullText }: { fullText: string }) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  const summarize = async () => {
    setLoading(true);
    try {
      const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
      if (!apiKey) throw new Error("APIキーが設定されていません");
      const res = await fetch("/api/llm/complete", {
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
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "要約に失敗しました");
      setSummary(data.output || "");
    } catch (e: any) {
      setSummary(`エラー: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const blob = new Blob([summary || fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minutes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
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
      {summary && (
        <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{summary}</pre>
      )}
    </Card>
  );
}
