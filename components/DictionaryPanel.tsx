"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useState } from "react";
import { parseDictionaryFile } from "@/lib/dictionary/parse";
import { TranscriptSegment } from "@/lib/transcript/types";
import { buildMappings, applyMappings, type Mapping } from "@/lib/dictionary/mapping";
import { useDictionary } from "@/lib/state/dictionary";

export default function DictionaryPanel({ segments, setSegments }: { segments: TranscriptSegment[]; setSegments: (s: TranscriptSegment[]) => void }) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const dict = useDictionary();
  const [count, setCount] = useState<number>(0);

  const onFile = async (f: File) => {
    const lines = await parseDictionaryFile(f);
    const maps = buildMappings(lines);
    setMappings(maps);
    dict.setMappings(maps);
  };

  const apply = () => {
    let changed = 0;
    const next = segments.map((s) => {
      const t = applyMappings(s.text, mappings);
      if (t !== s.text) changed++;
      return { ...s, text: t };
    });
    setSegments(next);
    setCount(changed);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">辞書（md/pdf）</div>
        <div className="flex items-center gap-2">
          <input type="file" accept=".md,.pdf,.txt" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
          <Button onClick={apply} disabled={mappings.length === 0}>
            反映
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {mappings.length > 0 ? `マッピング数: ${mappings.length}` : "'用語:正しい表記' 形式で記述してください"}
        {count > 0 && ` ／ 変更セグメント: ${count}`}
      </div>
    </Card>
  );
}
