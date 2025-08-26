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
    summaryOrder?: Array<"tldr" | "decisions" | "discussion" | "risks" | "issues" | "next">;
    summaryTitles?: { tldr: string; decisions: string; discussion: string; risks: string; issues: string; next: string };
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
    const detailHint = detail === "concise" ? "可能な限り簡潔に" : detail === "detailed" ? "必要に応じて詳細も" : "適度な粒度で";
    return [
      "あなたは会議議事録の要約アシスタントです。",
      `${detailHint}日本語のMarkdownで出力し、各項目は必ず見出し（##）を用いて区切ってください。`,
      "各項目では箇条書き（-）を用い、冗長表現は避け、事実ベースで簡潔に記述してください。",
      "次アクションには可能な限り担当者と期限を含めてください。",
      "出力は指定された見出しのみを含め、余計な前置きや後書きは不要です。",
    ].join(" ");
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
    const titles = o.summaryTitles || {
      tldr: "概要",
      decisions: "決定事項",
      discussion: "論点と結論",
      risks: "リスク",
      issues: "課題",
      next: "次アクション（担当/期限）",
    };
    const order = o.summaryOrder && Array.isArray(o.summaryOrder) && o.summaryOrder.length
      ? o.summaryOrder
      : ["tldr", "decisions", "discussion", "risks", "issues", "next"];
    const map: Record<string, { title: string; enabled: boolean } > = {
      tldr: { title: `## ${titles.tldr}`, enabled: o.includeTLDR !== false },
      decisions: { title: `## ${titles.decisions}`, enabled: o.includeDecisions !== false },
      discussion: { title: `## ${titles.discussion}`, enabled: o.includeDiscussion !== false },
      risks: { title: `## ${titles.risks}`, enabled: !!o.includeRisks },
      issues: { title: `## ${titles.issues}`, enabled: !!o.includeIssues },
      next: { title: `## ${titles.next}`, enabled: o.includeNextActions !== false },
    };
    const headings = order.filter((k) => map[k]?.enabled).map((k) => map[k].title);
    const lines = [
      "以下の会議テキストを要約してください。",
      "",
      "# 出力フォーマット要件",
      "次の順序・見出し（##）を正確に使ってMarkdownで出力してください。",
      ...headings,
      "",
      "# 注意",
      "- 各項目は箇条書きのみ",
      "- 可能な限り固有名詞・数値・担当・期限を保持",
      "- 余計な文章や前置きは不要",
      "",
      "# 入力",
      text,
    ].filter(Boolean);
    return lines.join("\n");
  }
  const tgtL = tgt || "en";
  return `Translate to ${tgtL}:\n\n${text}`;
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
