const FILLERS = [
  /\b(えー|あー|そのー|えっと|あのー)\b/g,
];

export function removeFillers(text: string) {
  return FILLERS.reduce((t, re) => t.replace(re, ""), text).replace(/\s{2,}/g, " ").trim();
}

export function basicPunctuate(text: string) {
  // simple heuristic: ensure sentence-ending punctuation for JP/EN mix
  return text
    .replace(/([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}a-zA-Z0-9])(\s+)(?=[A-Z\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1$2")
    .replace(/([^.。!?])$/u, "$1。");
}

