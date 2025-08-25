export type Speaker = "A" | "B";

export type TranscriptSegment = {
  id: string;
  text: string;
  speaker: Speaker;
  startMs?: number;
  endMs?: number;
};

export type SpeakerLabels = { A: string; B: string };
