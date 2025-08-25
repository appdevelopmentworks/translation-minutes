import { NextRequest, NextResponse } from "next/server";

type Task = "summary" | "translate";

type Payload = {
  task: Task;
  provider: "groq" | "openai";
  apiKey: string;
  model?: string;
  text: string;
  sourceLang?: string;
  targetLang?: string;
  options?: {
    translationFormality?: "formal" | "informal";
    summaryDetail?: "concise" | "standard" | "detailed";
    includeTLDR?: boolean;
    includeDecisions?: boolean;
    includeDiscussion?: boolean;
    includeRisks?: boolean;
    includeIssues?: boolean;
    includeNextActions?: boolean;
  };
};

const PROVIDERS = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
  },
  openai: {
    base: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Payload;
  if (!body?.apiKey || !body?.provider || !body?.text || !body?.task) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const cfg = PROVIDERS[body.provider];
  if (!cfg) return NextResponse.json({ error: "provider_not_supported" }, { status: 400 });

  const model = body.model || cfg.defaultModel;

  const sys = buildSystemPrompt(body.task, body.sourceLang, body.targetLang, body.options);
  const user = buildUserPrompt(body.task, body.text, body.sourceLang, body.targetLang, body.options);

  try {
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: "upstream_error", detail: t }, { status: 502 });
    }
    const data = await res.json();
    const output: string = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ output });
  } catch (e: any) {
    return NextResponse.json({ error: "network_error", detail: String(e?.message || e) }, { status: 500 });
  }
}

function buildSystemPrompt(
  task: Task,
  src?: string,
  tgt?: string,
  options?: Payload["options"]
) {
  if (task === "summary") {
    const detail = options?.summaryDetail ?? "standard";
    const tldr = options?.includeTLDR ?? true;
    const detailHint =
      detail === "concise" ? "可能な限り簡潔に" : detail === "detailed" ? "必要に応じて詳細も" : "適度な粒度で";
    const tldrHint = tldr ? "最初に1-2行のTL;DRを含め、" : "";
    return `あなたは会議議事録の要約アシスタントです。${tldrHint}決定事項/論点/結論/次アクション/期限/担当を日本語で${detailHint}Markdownで出力してください。不要な冗長表現は避け、箇条書きを用い、事実のみを要約します。`;
  }
  // translate
  const srcL = src || "auto";
  const tgtL = tgt || "en";
  const style = options?.translationFormality === "informal" ? "in an informal tone" : "in a formal tone";
  return `You are a precise translation assistant. Translate from ${srcL} to ${tgtL} ${style}, preserve meaning and formatting, keep terminology consistent. Do not add explanations.`;
}

function buildUserPrompt(
  task: Task,
  text: string,
  src?: string,
  tgt?: string,
  options?: Payload["options"]
) {
  if (task === "summary") {
    const o = options || {};
    const items: string[] = [];
    if (o.includeTLDR !== false) items.push("- 概要(TL;DR)");
    if (o.includeDecisions !== false) items.push("- 決定事項");
    if (o.includeDiscussion !== false) items.push("- 論点と結論");
    if (o.includeRisks) items.push("- リスク");
    if (o.includeIssues) items.push("- 課題");
    if (o.includeNextActions !== false) items.push("- 次アクション（担当/期限）");
    const lines = [
      "以下の会議テキストを要約し、Markdownで出力してください。",
      "",
      "# 出力要件",
      ...items,
      "",
      "# 入力",
      text,
    ].filter(Boolean);
    return lines.join("\n");
  }
  const tgtL = tgt || "en";
  return `Translate to ${tgtL}:\n\n${text}`;
}
