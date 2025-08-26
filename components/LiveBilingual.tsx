"use client";
import Card from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";

export default function LiveBilingual({
  source,
  translated,
}: {
  source: string[];
  translated: string[];
}) {
  const rows = pairRows(source, translated);
  const lastIdx = rows.length - 1;
  return (
    <Card className="space-y-2">
      <div className="text-sm font-medium">ライブ字幕（原文/訳）</div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.div
              key={`${i}-${r.src.slice(0, 8)}-${r.tr?.slice(0, 8)}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-md border p-2 ${r.provisional ? "border-amber-300 bg-amber-50" : "border-border bg-background"}`}
            >
              <div className={`text-sm leading-relaxed ${r.provisional ? "text-muted-foreground" : ""}`}>{r.src}</div>
              {r.tr && (
                <div className={`mt-1 text-sm leading-relaxed ${r.provisional ? "text-muted-foreground" : ""}`}>{r.tr}</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function pairRows(src: string[], tr: string[]) {
  const n = Math.max(src.length, tr.length);
  const rows: { src: string; tr?: string; provisional?: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const s = src[i];
    const t = tr[i];
    if (!s && !t) continue;
    rows.push({ src: s || "", tr: t, provisional: i === n - 1 && (!t || t.length === 0) });
  }
  return rows;
}

