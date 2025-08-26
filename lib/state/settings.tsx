"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Provider = "groq" | "openai";

export type Settings = {
  apiProvider: Provider;
  groqApiKey?: string;
  openaiApiKey?: string;
  sttViaProxy: boolean; // STTをAPI経由でプロキシする
  sttForceWav: boolean; // 互換性優先で常時WAVに変換
  sttEnabled: boolean; // ON/OFF for sending audio to API
  translateEnabled: boolean;
  language: string; // source language hint
  targetLanguage: string; // translation target
  liveChunkSeconds: number; // ライブ録音のチャンク秒数
  livePcmWavMode: boolean; // MediaRecorderを使わずPCM→WAVで送信
  vadThresholdDb: number;
  vadHangoverMs: number;
  vadSilenceTurnMs: number;
  meetingTitle: string;
  meetingDate: string; // ISO date string
  meetingParticipants: string; // comma-separated
  translationFormality: "formal" | "informal";
  summaryDetail: "concise" | "standard" | "detailed";
  summaryOrder: Array<"tldr" | "decisions" | "discussion" | "risks" | "issues" | "next">;
  summaryTitles: {
    tldr: string;
    decisions: string;
    discussion: string;
    risks: string;
    issues: string;
    next: string;
  };
  summaryIncludeTLDR: boolean;
  summaryIncludeDecisions: boolean;
  summaryIncludeDiscussion: boolean;
  summaryIncludeRisks: boolean;
  summaryIncludeIssues: boolean;
  summaryIncludeNextActions: boolean;
  translateUseDictionary: boolean;
  showLiveTimestamps: boolean;
  chunkImportEnabled: boolean;
  chunkSeconds: number;
  wakeLockEnabled: boolean;
};

const DEFAULTS: Settings = {
  apiProvider: "openai",
  sttViaProxy: (typeof process !== "undefined" ? (process as any).env?.NEXT_PUBLIC_STT_VIA_PROXY : undefined) === "1",
  sttEnabled: true,
  sttForceWav: false,
  translateEnabled: true,
  language: "ja",
  targetLanguage: "en",
  liveChunkSeconds: 3,
  livePcmWavMode: true,
  vadThresholdDb: 12,
  vadHangoverMs: 200,
  vadSilenceTurnMs: 600,
  meetingTitle: "会議ノート",
  meetingDate: new Date().toISOString().slice(0, 10),
  meetingParticipants: "",
  translationFormality: "formal",
  summaryDetail: "standard",
  summaryOrder: ["tldr", "decisions", "discussion", "risks", "issues", "next"],
  summaryTitles: {
    tldr: "概要",
    decisions: "決定事項",
    discussion: "論点と結論",
    risks: "リスク",
    issues: "課題",
    next: "次アクション（担当/期限）",
  },
  summaryIncludeTLDR: true,
  summaryIncludeDecisions: true,
  summaryIncludeDiscussion: true,
  summaryIncludeRisks: false,
  summaryIncludeIssues: false,
  summaryIncludeNextActions: true,
  translateUseDictionary: true,
  showLiveTimestamps: true,
  chunkImportEnabled: true,
  chunkSeconds: 60,
  wakeLockEnabled: true,
};

const KEY = "tm_settings_v1";

const Ctx = createContext<{
  settings: Settings;
  setSettings: (s: Settings) => void;
} | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  const value = useMemo(() => ({ settings, setSettings }), [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
