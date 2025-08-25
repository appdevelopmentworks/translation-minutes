export function splitTextToSentences(text: string): string[] {
  // Split by Japanese/English sentence endings without lookbehind (for wider runtime support)
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  // Insert a newline after sentence-ending punctuation, then split on newlines
  const marked = normalized
    .replace(/([。．！？!?\.])(\s*|\n+)/gu, "$1\n")
    .replace(/([。．！？!?\.])$/u, "$1\n");
  return marked
    .split(/\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}
