"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Provider = "groq" | "openai";

export type Settings = {
  apiProvider: Provider;
  groqApiKey?: string;
  openaiApiKey?: string;
  sttEnabled: boolean; // ON/OFF for sending audio to API
  translateEnabled: boolean;
  language: string; // source language hint
  targetLanguage: string; // translation target
  vadThresholdDb: number;
  vadHangoverMs: number;
  vadSilenceTurnMs: number;
  meetingTitle: string;
  meetingDate: string; // ISO date string
  meetingParticipants: string; // comma-separated
  translationFormality: "formal" | "informal";
  summaryDetail: "concise" | "standard" | "detailed";
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
};

const DEFAULTS: Settings = {
  apiProvider: "groq",
  sttEnabled: true,
  translateEnabled: true,
  language: "ja",
  targetLanguage: "en",
  vadThresholdDb: 12,
  vadHangoverMs: 200,
  vadSilenceTurnMs: 600,
  meetingTitle: "会議ノート",
  meetingDate: new Date().toISOString().slice(0, 10),
  meetingParticipants: "",
  translationFormality: "formal",
  summaryDetail: "standard",
  summaryIncludeTLDR: true,
  summaryIncludeDecisions: true,
  summaryIncludeDiscussion: true,
  summaryIncludeRisks: false,
  summaryIncludeIssues: false,
  summaryIncludeNextActions: true,
  translateUseDictionary: true,
  showLiveTimestamps: true,
  chunkImportEnabled: true,
  chunkSeconds: 15,
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
