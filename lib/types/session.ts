import type { TranscriptSegment } from "@/lib/transcript/types";
import type { SpeakerLabels } from "@/lib/transcript/types";

export type LocalSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  data: {
    lines: string[];
    segments: TranscriptSegment[];
    translated: string[];
    speakerLabels: SpeakerLabels;
    meetingTitle?: string;
    meetingDate?: string;
    meetingParticipants?: string;
  };
};

