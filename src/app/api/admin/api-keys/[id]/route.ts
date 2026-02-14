import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) {
    return NextResponse.json({ error: "API-ключ не найден" }, { status: 404 });
  }

  const allowedFields = ["name", "isActive", "rateLimit", "expiresAt"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = field === "expiresAt" && body[field] ? new Date(body[field]) : body[field];
    }
  }

  const updated = await prisma.apiKey.update({ where: { id }, data });
  return NextResponse.json({ ...updated, key: `${updated.key.slice(0, 8)}...${updated.key.slice(-4)}` });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) {
    return NextResponse.json({ error: "API-ключ не найден" }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
