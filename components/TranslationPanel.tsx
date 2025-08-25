"use client";
import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSettings } from "@/lib/state/settings";
import { useDictionary } from "@/lib/state/dictionary";
import { applyMappings } from "@/lib/dictionary/mapping";

export default function TranslationPanel({ fullText }: { fullText: string }) {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const { mappings } = useDictionary();

  const translate = async () => {
    setLoading(true);
    try {
      const apiKey = settings.apiProvider === "groq" ? settings.groqApiKey : settings.openaiApiKey;
      if (!apiKey) throw new Error("APIキーが設定されていません");
      const text = settings.translateUseDictionary && mappings?.length ? applyMappings(fullText, mappings) : fullText;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "翻訳に失敗しました");
      setOutput(data.output || "");
    } catch (e: any) {
      setOutput(`エラー: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">翻訳</div>
        <Button onClick={translate} disabled={loading}>
          {loading ? "翻訳中…" : "翻訳"}
        </Button>
      </div>
      {output && <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{output}</pre>}
    </Card>
  );
}
