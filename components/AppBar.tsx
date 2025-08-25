"use client";
import { cn } from "@/lib/utils";

export default function AppBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="truncate text-base font-semibold">{title}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

