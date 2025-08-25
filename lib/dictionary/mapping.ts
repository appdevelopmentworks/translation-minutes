export type Mapping = { from: string; to: string };

export function buildMappings(lines: string[]): Mapping[] {
  const maps: Mapping[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const sep = ["=>", "->", ":"].find((s) => line.includes(s));
    if (sep) {
      const [from, to] = line.split(sep);
      if (from && to) maps.push({ from: from.trim(), to: to.trim() });
    }
  }
  return maps;
}

export function applyMappings(text: string, mappings: Mapping[]) {
  let out = text;
  for (const m of mappings) {
    if (!m.from) continue;
    const re = new RegExp(m.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, m.to);
  }
  return out;
}

