"use client";
import React, { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: string; message: string; type?: "info" | "success" | "error" };

const Ctx = createContext<{
  toasts: Toast[];
  show: (message: string, type?: Toast["type"]) => void;
  remove: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = (message: string, type: Toast["type"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => remove(id), 3000);
  };
  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const value = useMemo(() => ({ toasts, show, remove }), [toasts]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-screen-sm flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full rounded-md border px-3 py-2 text-sm shadow ${
              t.type === "success"
                ? "border-green-600/20 bg-green-600/10 text-green-900"
                : t.type === "error"
                ? "border-red-600/20 bg-red-600/10 text-red-900"
                : "border-border bg-background"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

