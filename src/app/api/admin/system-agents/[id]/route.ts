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

  const agent = await prisma.agent.findFirst({
    where: { id, isSystem: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  // Map admin fields to Agent model
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.systemPrompt !== undefined) data.instructions = body.systemPrompt;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.iconColor !== undefined) data.iconColor = body.iconColor;
  if (body.model !== undefined) data.model = body.model;
  if (body.isActive !== undefined) data.status = body.isActive ? "APPROVED" : "PENDING";
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const updated = await prisma.agent.update({ where: { id }, data });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    systemPrompt: updated.instructions,
    icon: updated.icon,
    iconColor: updated.iconColor,
    model: updated.model,
    isActive: updated.status === "APPROVED",
    sortOrder: updated.sortOrder,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const agent = await prisma.agent.findFirst({
    where: { id, isSystem: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
