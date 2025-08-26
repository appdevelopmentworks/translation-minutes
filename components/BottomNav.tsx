"use client";

// Lightweight inline SVG icons to avoid external deps
function MicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z"/>
    </svg>
  );
}
function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2 2h-.5v-.5l10.06-10.06.5.5L5 19.25Zm13.71-11.46a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.34 1.34 3.75 3.75 1.34-1.34Z"/>
    </svg>
  );
}
function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 3a1 1 0 0 1 1 1v7.59l2.3-2.3 1.4 1.42L12 15.42 7.3 10.7l1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1Zm-7 14h2v2H5a2 2 0 0 1-2-2v-2h2v2Zm16 0v-2h2v2a2 2 0 0 1-2 2h-2v-2h2ZM5 7V5a2 2 0 0 1 2-2h2v2H7v2H5Zm12-4h2a2 2 0 0 1 2 2v2h-2V5h-2V3Z"/>
    </svg>
  );
}
function CogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M10.32 2.6a1.5 1.5 0 0 1 3.36 0l.11.8c.33.1.64.22.95.37l.7-.4a1.5 1.5 0 1 1 1.5 2.6l-.7.4c.2.3.36.61.5.94l.8.12a1.5 1.5 0 0 1 0 3l-.8.12c-.1.33-.23.64-.4.94l.4.7a1.5 1.5 0 1 1-2.6 1.5l-.4-.7c-.3.18-.61.32-.94.42l-.12.8a1.5 1.5 0 0 1-3 0l-.12-.8a6 6 0 0 1-.94-.42l-.7.4a1.5 1.5 0 1 1-1.5-2.6l.7-.4a5.9 5.9 0 0 1-.4-.94l-.8-.12a1.5 1.5 0 1 1 0-3l.8-.12c.1-.33.26-.64.44-.94l-.44-.7a1.5 1.5 0 1 1 2.6-1.5l.7.4c.31-.15.62-.27.95-.37l.11-.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
    </svg>
  );
}

type Tab = "record" | "edit" | "export" | "settings";

export default function BottomNav({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { key: "record", label: "録音", icon: MicIcon },
    { key: "edit", label: "編集", icon: PencilIcon },
    { key: "export", label: "出力", icon: UploadIcon },
    { key: "settings", label: "設定", icon: CogIcon },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-4 px-1 py-2">
        {items.map((it) => {
          const Icon = it.icon;
          const active = current === it.key;
          return (
            <li key={it.key}>
              <button
                onClick={() => onChange(it.key)}
                className={`mx-auto flex w-full flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
