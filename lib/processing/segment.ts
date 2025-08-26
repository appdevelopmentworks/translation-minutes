export function splitTextToSentences(text: string): string[] {
  // Split by Japanese/English sentence endings without lookbehind (for wider runtime support)
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  // Insert a newline after sentence-ending punctuation, then split on newlines
  const marked = normalized
    .replace(/([。．！？!?\.])(\s*|\n+)/gu, "$1\n")
    .replace(/([。．！？!?\.])$/u, "$1\n");
  return marked
    .split(/\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type AB = "A" | "B";

export function autoClusterAB<Seg extends { startMs?: number; endMs?: number; speaker?: AB; text: string; id?: string }>(
  segments: Seg[],
  gapMs: number
): Seg[] {
  if (!segments.length) return segments;
  const items = [...segments];
  // Preserve original order, but use provided startMs when available to detect gaps
  let cur: AB = "A";
  let prevEnd: number | undefined = items[0].startMs ?? 0;
  return items.map((s, i) => {
    const start = typeof s.startMs === "number" ? s.startMs : (typeof prevEnd === "number" ? prevEnd + 1 : i * 2000);
    const end = typeof s.endMs === "number" ? s.endMs : start + Math.max(500, Math.min(4000, Math.round((s.text?.length || 10) * 80)));
    if (typeof prevEnd === "number" && start - prevEnd > gapMs) {
      // Considered a new turn
      cur = cur === "A" ? "B" : "A";
    }
    prevEnd = end;
    return { ...s, speaker: (s.speaker as AB) ?? cur };
  });
}

// Merge consecutive segments into sentence-like units using punctuation and gap heuristics
export function mergeSegmentsBySentence<Seg extends { id: string; text: string; speaker?: AB; startMs?: number; endMs?: number }>(
  segments: Seg[],
  opts: { maxGapMs?: number; minChars?: number } = {}
): Seg[] {
  const maxGap = opts.maxGapMs ?? 800; // merge if within this gap
  const minChars = opts.minChars ?? 20; // ensure minimum size
  const out: Seg[] = [];
  let acc: Seg | null = null;
  const isSentenceEnd = (t: string) => /[。．！？!?\.]['””』"]?$/.test(t.trim());
  for (const s of segments) {
    if (!acc) {
      acc = { ...s };
      continue;
    }
    const sameSpeaker = !s.speaker || !acc.speaker || s.speaker === acc.speaker;
    const gap = typeof s.startMs === "number" && typeof acc.endMs === "number" ? s.startMs - acc.endMs : 0;
    const canMerge = sameSpeaker && (gap <= maxGap || !isSentenceEnd(acc.text) || (acc.text + s.text).length < minChars);
    if (canMerge) {
      acc = {
        ...acc,
        text: `${acc.text} ${s.text}`.replace(/\s+/g, " ").trim(),
        endMs: s.endMs ?? acc.endMs,
      };
    } else {
      out.push(acc);
      acc = { ...s };
    }
  }
  if (acc) out.push(acc);
  return out;
}
