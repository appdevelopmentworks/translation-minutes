"use client";
import { useState } from "react";
import RecorderControls from "@/components/RecorderControls";
import LiveTranscript from "@/components/LiveTranscript";
import LiveTranslation from "@/components/LiveTranslation";
import SummaryPanel from "@/components/SummaryPanel";
import TranslationPanel from "@/components/TranslationPanel";
import SettingsSheet from "@/components/SettingsSheet";
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
  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Translation Minutes</h1>
      <SettingsSheet />
      <AudioPlayerPanel />
      <FileTranscribePanel
        onAppend={(newLines, newSegs) => {
          setLines((prev: string[]) => [...prev, ...newLines]);
          setSegments((prev: TranscriptSegment[]) => [...prev, ...newSegs]);
        }}
      />
      <RecorderControls
        onTranscript={(t) => setLines((prev: string[]) => (t ? [...prev, t] : prev))}
        onSegment={(seg) => setSegments((prev: TranscriptSegment[]) => [...prev, seg])}
        onTranslate={(t) => setTranslated((prev: string[]) => (t ? [...prev, t] : prev))}
      />
      <LiveTranscript segments={segments} />
      <LiveTranslation lines={translated} />
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
      <TranscriptExportPanel segments={segments} labels={speakerLabels} />
      <SummaryPanel fullText={lines.join("\n")} />
      <TranslationPanel fullText={lines.join("\n")} />
    </main>
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
        </AudioPlayerProvider>
      </DictionaryProvider>
    </SettingsProvider>
  );
}
