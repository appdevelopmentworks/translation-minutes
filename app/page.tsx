"use client";
import { useState } from "react";
import RecorderControls from "@/components/RecorderControls";
import LiveBilingual from "@/components/LiveBilingual";
import SummaryPanel from "@/components/SummaryPanel";
import TranslationPanel from "@/components/TranslationPanel";
import SettingsSheet from "@/components/SettingsSheet";
import SettingsView from "@/components/SettingsView";
import { SettingsProvider, useSettings } from "@/lib/state/settings";
import EditorPanel from "@/components/EditorPanel";
import { TranscriptSegment } from "@/lib/transcript/types";
import TranscriptExportPanel from "@/components/TranscriptExportPanel";
import { SpeakerLabels } from "@/lib/transcript/types";
import DictionaryPanel from "@/components/DictionaryPanel";
import ServerSavePanel from "@/components/ServerSavePanel";
import { DictionaryProvider } from "@/lib/state/dictionary";
import FileTranscribePanel from "@/components/FileTranscribePanel";
import LocalSessionPanel from "@/components/LocalSessionPanel";
import AudioPlayerPanel from "@/components/AudioPlayerPanel";
import { AudioPlayerProvider } from "@/lib/state/audioPlayer";
import AppBar from "@/components/AppBar";
import BottomNav from "@/components/BottomNav";
import { AnimatePresence, m } from "framer-motion";
import { useWakeLock } from "@/lib/state/wakelock";
import { ToastProvider, useToast } from "@/lib/state/toast";

type Tab = "record" | "edit" | "export" | "settings";

function PageInner({
  lines, setLines,
  segments, setSegments,
  translated, setTranslated,
  speakerLabels, setSpeakerLabels,
}: {
  lines: string[];
  setLines: (u: any) => void;
  segments: TranscriptSegment[];
  setSegments: (u: any) => void;
  translated: string[];
  setTranslated: (u: any) => void;
  speakerLabels: SpeakerLabels;
  setSpeakerLabels: (u: any) => void;
}) {
  const { settings, setSettings } = useSettings();
  const [tab, setTab] = useHashTab();
  const [isRecording, setIsRecording] = useState(false);
  useWakeLock(isRecording && settings.wakeLockEnabled);
  const record = (
    <>
      <FileTranscribePanel
        onAppend={(newLines, newSegs) => {
          setLines((prev: string[]) => [...prev, ...newLines]);
          setSegments((prev: TranscriptSegment[]) => [...prev, ...newSegs]);
        }}
      />
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-flex h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted"}`} />
        <span className="text-muted-foreground">{isRecording ? "録音中" : "停止中"}</span>
      </div>
      <RecorderControls
        onTranscript={(t) => setLines((prev: string[]) => (t ? [...prev, t] : prev))}
        onSegment={(seg) => setSegments((prev: TranscriptSegment[]) => [...prev, seg])}
        onTranslate={(t) => setTranslated((prev: string[]) => (t ? [...prev, t] : prev))}
        onRecordingChange={setIsRecording}
      />
      <LiveBilingual source={lines} translated={translated} />
      <AudioPlayerPanel />
    </>
  );
  const edit = (
    <>
      <EditorPanel segments={segments} setSegments={setSegments} speakerLabels={speakerLabels} setSpeakerLabels={setSpeakerLabels} />
      <LocalSessionPanel
        lines={lines}
        segments={segments}
        translated={translated}
        speakerLabels={speakerLabels}
        meetingMeta={{
          title: settings.meetingTitle,
          date: settings.meetingDate,
          participants: settings.meetingParticipants,
        }}
        onLoad={({ lines: l, segments: s, translated: tr, speakerLabels: labels, meta }) => {
          setLines(l);
          setSegments(s);
          setTranslated(tr);
          setSpeakerLabels(labels);
          if (meta) {
            setSettings({
              ...settings,
              meetingTitle: meta.title || settings.meetingTitle,
              meetingDate: meta.date || settings.meetingDate,
              meetingParticipants: meta.participants || settings.meetingParticipants,
            });
          }
        }}
      />
      <ServerSavePanel segments={segments} />
      <DictionaryPanel segments={segments} setSegments={setSegments} />
    </>
  );
  const exp = (
    <>
      <TranscriptExportPanel segments={segments} labels={speakerLabels} />
      <SummaryPanel fullText={lines.join("\n")} />
      <TranslationPanel fullText={lines.join("\n")} />
    </>
  );
  const settingsView = <SettingsView />;

  const titleMap: Record<Tab, string> = { record: "録音", edit: "編集", export: "出力", settings: "設定" };
  const MotionSection: any = m.section as any;

  return (
    <>
      <AppBar title={`Translation Minutes — ${titleMap[tab]}`} />
      <main className="space-y-4">
        <AnimatePresence mode="wait">
          <MotionSection
            key={tab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {tab === "record" && record}
            {tab === "edit" && edit}
            {tab === "export" && exp}
            {tab === "settings" && settingsView}
          </MotionSection>
        </AnimatePresence>
      </main>
      <BottomNav current={tab} onChange={setTab} />
    </>
  );
}

export default function Page() {
  const [lines, setLines] = useState<string[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [translated, setTranslated] = useState<string[]>([]);
  const [speakerLabels, setSpeakerLabels] = useState<SpeakerLabels>({ A: "話者A", B: "話者B" });

  return (
    <SettingsProvider>
      <DictionaryProvider>
        <AudioPlayerProvider>
          <ToastProvider>
          <PageInner
            lines={lines}
            setLines={setLines}
            segments={segments}
            setSegments={setSegments}
            translated={translated}
            setTranslated={setTranslated}
            speakerLabels={speakerLabels}
            setSpeakerLabels={setSpeakerLabels}
          />
          </ToastProvider>
        </AudioPlayerProvider>
      </DictionaryProvider>
    </SettingsProvider>
  );
}

function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(() => (typeof window !== "undefined" && (location.hash.slice(1) as Tab)) || "record");
  function apply(t: Tab) {
    setTab(t);
    if (typeof window !== "undefined") location.hash = t;
  }
  return [tab, apply];
}
