"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useMemo, useState } from "react";
import { parseDictionaryFile } from "@/lib/dictionary/parse";
import { TranscriptSegment } from "@/lib/transcript/types";
import { buildMappings, applyMappings, type Mapping } from "@/lib/dictionary/mapping";
import { useDictionary } from "@/lib/state/dictionary";

export default function DictionaryPanel({ segments, setSegments }: { segments: TranscriptSegment[]; setSegments: (s: TranscriptSegment[]) => void }) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const dict = useDictionary();
  const [count, setCount] = useState<number>(0);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("");
  const filtered = useMemo(() => {
    if (!filter) return mappings;
    const q = filter.toLowerCase();
    return mappings.filter((m) => m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q));
  }, [mappings, filter]);

  const onFile = async (f: File) => {
    const lines = await parseDictionaryFile(f);
    const maps = buildMappings(lines);
    setMappings(maps);
    dict.setMappings(maps);
    setRawLines(lines);
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
          <Button variant="outline" onClick={() => { setMappings([]); dict.setMappings([]); setRawLines([]); setCount(0); }} disabled={mappings.length === 0}>
            クリア
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {mappings.length > 0 ? `マッピング数: ${mappings.length}` : "'用語:正しい表記'／'用語=>正しい表記' 形式で記述してください"}
        {count > 0 && ` ／ 変更セグメント: ${count}`}
      </div>
      {mappings.length > 0 && (
        <div className="rounded border border-border p-2 text-xs max-h-48 overflow-auto space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground">プレビュー（先頭20件）</div>
            <input
              className="w-40 rounded border border-input bg-background px-2 py-1"
              placeholder="検索…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {filtered.slice(0, 20).map((m, i) => (
            <div key={`${m.from}-${i}`} className="grid grid-cols-2 gap-2">
              <div className="truncate">{m.from}</div>
              <div className="truncate text-muted-foreground">→ {m.to}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
