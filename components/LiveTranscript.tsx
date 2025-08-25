"use client";
import Card from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import type { TranscriptSegment } from "@/lib/transcript/types";
import { useSettings } from "@/lib/state/settings";

export default function LiveTranscript({ segments }: { segments: TranscriptSegment[] }) {
  const { settings } = useSettings();
  return (
    <Card className="min-h-[30vh] space-y-2">
      <div className="text-sm font-medium">ライブ字幕</div>
      <div className="space-y-1 text-sm leading-relaxed">
        <AnimatePresence initial={false}>
          {segments.map((s, i) => (
            <motion.div key={`${s.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {settings.showLiveTimestamps && (
                <span className="mr-2 text-xs text-muted-foreground">[{msToTimestamp(s.startMs ?? i * 1000)}]</span>
              )}
              <span>{s.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function msToTimestamp(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
