"use client";
import Button from "@/components/ui/button";

type Tab = "record" | "edit" | "export" | "settings";

export default function BottomNav({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; label: string }[] = [
    { key: "record", label: "録音" },
    { key: "edit", label: "編集" },
    { key: "export", label: "出力" },
    { key: "settings", label: "設定" },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-2 px-2 py-2">
        {items.map((it) => (
          <Button
            key={it.key}
            size="sm"
            variant={current === it.key ? "default" : "outline"}
            onClick={() => onChange(it.key)}
          >
            {it.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

