"use client";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import SettingsSheet from "@/components/SettingsSheet";
import { useState } from "react";

const sections = [
  { id: "settings-meta", title: "エクスポートテンプレ（メタ情報）" },
  { id: "settings-vad", title: "VAD設定" },
  { id: "settings-live", title: "ライブ表示/取り込み" },
  { id: "settings-style", title: "翻訳/要約スタイル" },
];

export default function SettingsView() {
  const [q, setQ] = useState("");
  const onSearch = () => {
    const target =
      sections.find((s) => s.title.toLowerCase().includes(q.toLowerCase())) || sections[0];
    const el = document.getElementById(target.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Input placeholder="設定を検索…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button className="whitespace-nowrap" onClick={onSearch}>検索</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {sections.map((s) => (
            <button
              key={s.id}
              className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-accent"
              onClick={() => {
                const el = document.getElementById(s.id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </Card>
      <SettingsSheet />
    </div>
  );
}
