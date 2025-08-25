"use client";
import Card from "@/components/ui/card";
import { useAudioPlayer } from "@/lib/state/audioPlayer";

export default function AudioPlayerPanel() {
  const { loadFile, hasAudio } = useAudioPlayer();
  return (
    <Card className="space-y-2">
      <div className="text-sm font-medium">音声プレイヤ（実験）</div>
      <div className="flex items-center gap-2 text-sm">
        <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm" onChange={(e) => e.target.files && loadFile(e.target.files[0])} />
        <span className="text-xs text-muted-foreground">{hasAudio ? "読み込み済み。セグメントのジャンプが有効です" : "ファイルを選択して有効化"}</span>
      </div>
    </Card>
  );
}

