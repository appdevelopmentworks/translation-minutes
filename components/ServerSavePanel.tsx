"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { TranscriptSegment } from "@/lib/transcript/types";

export default function ServerSavePanel({ segments }: { segments: TranscriptSegment[] }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [title, setTitle] = useState<string>("会議ノート");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    // Feature detection: check if API is enabled (SERVER_PERSISTENCE=1)
    fetch("/api/sessions")
      .then((r) => setEnabled(r.ok))
      .catch(() => setEnabled(false));
  }, []);

  const createSession = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "作成に失敗しました");
      setSessionId(data.session.id);
      setMsg("セッションを作成しました");
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const saveSegments = async () => {
    if (!sessionId) {
      setMsg("先にセッションを作成してください");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        segments: segments.map((s) => ({
          startMs: s.startMs ?? null,
          endMs: s.endMs ?? null,
          speaker: s.speaker,
          text: s.text,
        })),
      };
      const res = await fetch(`/api/sessions/${sessionId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "保存に失敗しました");
      setMsg("保存しました");
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null || enabled === false) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">サーバ保存（自己ホスト時のみ）</div>
        <div className="text-xs text-muted-foreground">Prisma/SQLite</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" />
        </div>
        <Button onClick={createSession} disabled={busy}>セッション作成</Button>
      </div>
      <div className="flex items-center gap-2">
        <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="sessionId" />
        <Button onClick={saveSegments} disabled={busy || !sessionId}>
          {busy ? "保存中…" : "保存"}
        </Button>
      </div>
      {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
    </Card>
  );
}

