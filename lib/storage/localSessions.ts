import { get, put, remove } from "@/lib/storage/indexeddb";
import type { LocalSession } from "@/lib/types/session";

const STORE: "sessions" = "sessions";

export async function createLocalSession(title: string, data: LocalSession["data"]): Promise<LocalSession> {
  const now = Date.now();
  const id = `local-${now}`;
  const sess: LocalSession = { id, title, createdAt: now, updatedAt: now, data };
  await put(STORE, sess);
  return sess;
}

export async function updateLocalSession(id: string, patch: Partial<LocalSession>): Promise<LocalSession> {
  const existing = await get<LocalSession>(STORE, id);
  if (!existing) throw new Error("Session not found");
  const updated: LocalSession = {
    ...existing,
    ...patch,
    data: { ...existing.data, ...(patch as any).data },
    updatedAt: Date.now(),
  };
  await put(STORE, updated);
  return updated;
}

export async function getLocalSession(id: string): Promise<LocalSession | undefined> {
  return get<LocalSession>(STORE, id);
}

export async function listLocalSessions(): Promise<LocalSession[]> {
  // IndexedDBラッパは一覧が無いので、sessionsに独自インデックスを持っていない。
  // 簡易実装として、ドキュメント側に一覧をキャッシュするのが理想だが、
  // MVPではキーがわからないため、IDを既知にできる最新保存/読込のみに限定する。
  // → 簡易対応: localStorageのキーにIDリストを保持。
  const key = "tm_local_session_ids";
  const ids: string[] = JSON.parse(localStorage.getItem(key) || "[]");
  const results: LocalSession[] = [];
  for (const id of ids) {
    const s = await getLocalSession(id);
    if (s) results.push(s);
  }
  // 新規に保存時はこの関数外でIDを追加する想定
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function appendLocalSessionId(id: string) {
  const key = "tm_local_session_ids";
  const ids: string[] = JSON.parse(localStorage.getItem(key) || "[]");
  if (!ids.includes(id)) {
    ids.unshift(id);
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 50)));
  }
}

export async function deleteLocalSession(id: string) {
  await remove(STORE, id);
  const key = "tm_local_session_ids";
  const ids: string[] = JSON.parse(localStorage.getItem(key) || "[]");
  const next = ids.filter((x) => x !== id);
  localStorage.setItem(key, JSON.stringify(next));
}

