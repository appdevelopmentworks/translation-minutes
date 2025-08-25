import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

function disabled() {
  return process.env.SERVER_PERSISTENCE !== "1";
}

export async function GET() {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  if (disabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const title = body?.title || "Session";
  const created = await prisma.session.create({ data: { title } });
  return NextResponse.json({ session: created });
}

