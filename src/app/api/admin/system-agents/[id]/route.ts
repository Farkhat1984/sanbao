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

  const agent = await prisma.systemAgent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  const allowedFields = ["name", "description", "systemPrompt", "icon", "iconColor", "model", "isActive", "sortOrder"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const updated = await prisma.systemAgent.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const agent = await prisma.systemAgent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  await prisma.systemAgent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
