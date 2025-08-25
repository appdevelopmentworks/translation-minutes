import { NextResponse } from "next/server";
// Lazy-load Prisma only when persistence is enabled

function disabled() {
  return process.env.SERVER_PERSISTENCE !== "1";
}

async function getPrisma() {
  const mod = await import("@/lib/server/prisma");
  return mod.prisma;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const sessionId = params.id;
  const prisma = await getPrisma();
  const segments = await prisma.segment.findMany({ where: { sessionId }, orderBy: { idx: "asc" } });
  return NextResponse.json({ segments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const sessionId = params.id;
  const body = await req.json().catch(() => ({}));
  const segments: Array<{ startMs?: number; endMs?: number; speaker: string; text: string }> = body?.segments ?? [];
  // Delete and replace (simple upsert strategy for MVP)
  const prisma = await getPrisma();
  await prisma.$transaction([
    prisma.segment.deleteMany({ where: { sessionId } }),
    prisma.segment.createMany({
      data: segments.map((s, i) => ({ sessionId, startMs: s.startMs ?? null, endMs: s.endMs ?? null, speaker: s.speaker, text: s.text, idx: i })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
