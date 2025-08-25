import { NextResponse } from "next/server";
// Lazy-load Prisma only when persistence is enabled

function disabled() {
  return process.env.SERVER_PERSISTENCE !== "1";
}

async function getPrisma() {
  const mod = await import("@/lib/server/prisma");
  return mod.prisma;
}

export async function GET() {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const prisma = await getPrisma();
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const title = body?.title || "Session";
  const prisma = await getPrisma();
  const created = await prisma.session.create({ data: { title } });
  return NextResponse.json({ session: created });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
