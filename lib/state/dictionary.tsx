"use client";
import React, { createContext, useContext, useMemo, useState } from "react";
import type { Mapping } from "@/lib/dictionary/mapping";

const Ctx = createContext<{
  mappings: Mapping[];
  setMappings: (m: Mapping[]) => void;
} | null>(null);

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const value = useMemo(() => ({ mappings, setMappings }), [mappings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDictionary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDictionary must be used within DictionaryProvider");
  return ctx;
}

