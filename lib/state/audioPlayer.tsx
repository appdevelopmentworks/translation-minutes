"use client";
import React, { createContext, useContext, useMemo, useRef, useState } from "react";

const Ctx = createContext<{
  loadFile: (f: File) => void;
  seekMs: (ms: number) => void;
  hasAudio: boolean;
}>({ loadFile: () => {}, seekMs: () => {}, hasAudio: false });

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasAudio, setHasAudio] = useState(false);

  const loadFile = (f: File) => {
    const url = URL.createObjectURL(f);
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.onloadedmetadata = () => setHasAudio(true);
    audioRef.current.onended = () => setHasAudio(true);
    audioRef.current.load();
  };

  const seekMs = (ms: number) => {
    if (!audioRef.current || !hasAudio) return;
    try {
      audioRef.current.currentTime = Math.max(0, ms / 1000);
      audioRef.current.play().catch(() => {});
    } catch {}
  };

  const value = useMemo(() => ({ loadFile, seekMs, hasAudio }), [hasAudio]);
  return <Ctx.Provider value={value}>{children}<audio hidden ref={(el) => (audioRef.current = el)} /></Ctx.Provider>;
}

export function useAudioPlayer() {
  return useContext(Ctx);
}

