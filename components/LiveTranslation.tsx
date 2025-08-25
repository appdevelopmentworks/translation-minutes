"use client";
import Card from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";

export default function LiveTranslation({ lines }: { lines: string[] }) {
  return (
    <Card className="min-h-[20vh] space-y-2">
      <div className="text-sm font-medium">ライブ翻訳</div>
      <div className="space-y-1 text-sm leading-relaxed">
        <AnimatePresence initial={false}>
          {lines.map((l, i) => (
            <motion.div key={`${i}-${l.slice(0, 8)}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {l}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

