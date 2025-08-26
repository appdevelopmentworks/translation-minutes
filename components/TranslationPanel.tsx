"use client";
import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Switch from "@/components/ui/switch";
import { useSettings } from "@/lib/state/settings";
import { useDictionary } from "@/lib/state/dictionary";
import { applyMappings } from "@/lib/dictionary/mapping";
import { useToast } from "@/lib/state/toast";
import { fetchJsonWithRetry } from "@/lib/utils";

export default function TranslationPanel({ fullText }: { fullText: string }) {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { settings, setSettings } = useSettings();
  const { mappings } = useDictionary();
  const toast = useToast();

  const translate = async () => {
    setLoading(true);
    try {
      const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
      if (!apiKey) throw new Error("APIキーが設定されていません");
      const text = settings.translateUseDictionary && mappings?.length ? applyMappings(fullText, mappings) : fullText;
      const { json } = await fetchJsonWithRetry<{ output?: string }>(
        "/api/llm/complete",
        {
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
        },
        2,
        400
      );
      setOutput(json?.output || "");
      toast.show("翻訳が完了しました", "success");
    } catch (e: any) {
      setOutput(`エラー: ${e?.message || e}`);
      toast.show(`翻訳エラー: ${e?.message || e}` as string, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">翻訳</div>
        <Button onClick={translate} disabled={loading}>
          {loading ? "翻訳中…" : "翻訳"}
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <span>フォーマリティ: {settings.translationFormality === "informal" ? "カジュアル" : "フォーマル"}</span>
          <span>見出し: {settings.summaryTitles.tldr}/{settings.summaryTitles.decisions}/…</span>
        </div>
        <div className="flex items-center gap-2">
          <span>辞書適用</span>
          <Switch
            checked={settings.translateUseDictionary}
            onCheckedChange={(v) => setSettings({ ...settings, translateUseDictionary: v })}
          />
        </div>
      </div>
      {output && (
        <div className="space-y-2">
          <div className="text-sm font-medium">## 翻訳結果</div>
          <div className="h-px w-full bg-border" />
          <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm break-words">{output}</pre>
        </div>
      )}
    </Card>
  );
}
