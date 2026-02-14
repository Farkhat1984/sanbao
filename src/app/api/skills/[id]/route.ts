import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const skill = await prisma.skill.findFirst({
    where: {
      id,
      OR: [
        { isBuiltIn: true },
        { userId: session.user.id },
        { isPublic: true },
      ],
    },
  });

  if (!skill) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  return NextResponse.json({
    ...skill,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.skill.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Не найдено или нет доступа" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor, isPublic } = body;

  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(systemPrompt !== undefined && { systemPrompt: systemPrompt.trim() }),
      ...(templates !== undefined && { templates }),
      ...(citationRules !== undefined && { citationRules: citationRules?.trim() || null }),
      ...(jurisdiction !== undefined && { jurisdiction }),
      ...(icon !== undefined && { icon }),
      ...(iconColor !== undefined && { iconColor }),
      ...(isPublic !== undefined && { isPublic }),
    },
  });

  return NextResponse.json({
    ...skill,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.skill.findFirst({
    where: { id, userId: session.user.id, isBuiltIn: false },
  });

  if (!existing) {
    return NextResponse.json({ error: "Не найдено или нельзя удалить" }, { status: 404 });
  }

  await prisma.skill.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
