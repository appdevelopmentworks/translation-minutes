import { put, get, remove } from "@/lib/storage/indexeddb";
import type { TranscriptSegment } from "@/lib/transcript/types";
import type { SpeakerLabels } from "@/lib/transcript/types";

export type Snapshot = {
  lines: string[];
  segments: TranscriptSegment[];
  translated: string[];
  speakerLabels: SpeakerLabels;
  meetingTitle?: string;
  meetingDate?: string;
  meetingParticipants?: string;
  savedAt: number;
};

const STORE = "documents" as const;
const KEY = "autosave_snapshot";

export async function saveAutosave(s: Omit<Snapshot, "savedAt">) {
  const snap: Snapshot = { ...s, savedAt: Date.now(), id: KEY } as any;
  await put(STORE, snap as any);
}

export async function loadAutosave(): Promise<Snapshot | undefined> {
  const snap = await get<Snapshot>(STORE, KEY as any);
  return snap || undefined;
}

export async function clearAutosave() {
  await remove(STORE, KEY as any);
}

