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

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return NextResponse.json({ error: "Скилл не найден" }, { status: 404 });
  }

  const allowedFields = ["name", "description", "systemPrompt", "templates", "citationRules", "jurisdiction", "icon", "iconColor", "isBuiltIn", "isPublic", "status"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const updated = await prisma.skill.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    return NextResponse.json({ error: "Скилл не найден" }, { status: 404 });
  }

  await prisma.skill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
