// Placeholder: parse .md or .pdf into a list of terms.
// For PDF, integrate pdf.js in a later step.

export async function parseDictionaryFile(file: File): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "txt") {
    const text = await file.text();
    return extractTerms(text);
  }
  if (ext === "pdf") {
    try {
      const { getDocument } = await import("pdfjs-dist");
      const data = await file.arrayBuffer();
      const loadingTask = getDocument({ data });
      const pdf = await loadingTask.promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str).join(" ") + "\n";
      }
      return extractTerms(text);
    } catch (e) {
      console.error("pdf parse error", e);
      return [];
    }
  }
  return [];
}

function extractTerms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    )
  );
}
