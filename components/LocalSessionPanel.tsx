"use client";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useEffect, useState } from "react";
import type { TranscriptSegment } from "@/lib/transcript/types";
import type { SpeakerLabels } from "@/lib/transcript/types";
import type { LocalSession } from "@/lib/types/session";
import { appendLocalSessionId, createLocalSession, deleteLocalSession, getLocalSession, listLocalSessions, updateLocalSession } from "@/lib/storage/localSessions";

type Props = {
  lines: string[];
  segments: TranscriptSegment[];
  translated: string[];
  speakerLabels: SpeakerLabels;
  meetingMeta: { title?: string; date?: string; participants?: string };
  onLoad: (payload: { lines: string[]; segments: TranscriptSegment[]; translated: string[]; speakerLabels: SpeakerLabels; meta?: { title?: string; date?: string; participants?: string } }) => void;
};

export default function LocalSessionPanel({ lines, segments, translated, speakerLabels, meetingMeta, onLoad }: Props) {
  const [title, setTitle] = useState("ローカルセッション");
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    const list = await listLocalSessions();
    setSessions(list);
  };

  useEffect(() => {
    refresh();
  }, []);

  const snapshot = () => ({
    lines,
    segments,
    translated,
    speakerLabels,
    meetingTitle: meetingMeta.title,
    meetingDate: meetingMeta.date,
    meetingParticipants: meetingMeta.participants,
  });

  const saveNew = async () => {
    setBusy(true);
    setMsg("");
    try {
      const data = snapshot();
      const sess = await createLocalSession(title || "ローカルセッション", {
        lines: data.lines,
        segments: data.segments,
        translated: data.translated,
        speakerLabels: data.speakerLabels,
        meetingTitle: data.meetingTitle,
        meetingDate: data.meetingDate,
        meetingParticipants: data.meetingParticipants,
      });
      appendLocalSessionId(sess.id);
      setCurrentId(sess.id);
      setMsg("保存しました");
      refresh();
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const saveUpdate = async () => {
    if (!currentId) {
      setMsg("先に読み込むか新規保存してください");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const data = snapshot();
      await updateLocalSession(currentId, {
        title: title || "ローカルセッション",
        data: {
          lines: data.lines,
          segments: data.segments,
          translated: data.translated,
          speakerLabels: data.speakerLabels,
          meetingTitle: data.meetingTitle,
          meetingDate: data.meetingDate,
          meetingParticipants: data.meetingParticipants,
        },
      } as any);
      setMsg("上書き保存しました");
      refresh();
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const load = async (id: string) => {
    setBusy(true);
    setMsg("");
    try {
      const s = await getLocalSession(id);
      if (!s) throw new Error("データが見つかりません");
      setCurrentId(id);
      setTitle(s.title);
      onLoad({
        lines: s.data.lines,
        segments: s.data.segments,
        translated: s.data.translated,
        speakerLabels: s.data.speakerLabels,
        meta: { title: s.data.meetingTitle, date: s.data.meetingDate, participants: s.data.meetingParticipants },
      });
      setMsg("読み込みました");
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setMsg("");
    try {
      await deleteLocalSession(id);
      if (currentId === id) setCurrentId("");
      refresh();
      setMsg("削除しました");
    } catch (e: any) {
      setMsg(`エラー: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    const data = snapshot();
    const payload = { title, ...data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minutes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    setTitle(data.title || "ローカルセッション");
    onLoad({
      lines: data.lines || [],
      segments: data.segments || [],
      translated: data.translated || [],
      speakerLabels: data.speakerLabels || { A: "話者A", B: "話者B" },
      meta: { title: data.meetingTitle, date: data.meetingDate, participants: data.meetingParticipants },
    });
    setMsg("インポートしました（未保存）");
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">ローカル保存/読み込み（IndexedDB）</div>
        {busy && <div className="text-xs text-muted-foreground">処理中…</div>}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <Input placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button onClick={saveNew} disabled={busy}>新規保存</Button>
        <Button onClick={saveUpdate} disabled={busy || !currentId}>上書き保存</Button>
      </div>
      <div className="grid gap-2">
        <div className="text-sm">保存済み</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sessions.length === 0 && <div className="text-xs text-muted-foreground">まだ保存がありません</div>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div className="truncate">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => load(s.id)} disabled={busy}>読み込み</Button>
                <Button size="sm" variant="outline" onClick={() => remove(s.id)} disabled={busy}>削除</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Button className="w-full sm:w-auto" variant="outline" onClick={exportJson}>JSONエクスポート</Button>
        <input
          className="w-full sm:w-auto text-sm"
          type="file"
          accept="application/json"
          onChange={(e) => e.target.files && importJson(e.target.files[0])}
        />
      </div>
      {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
    </Card>
  );
}
