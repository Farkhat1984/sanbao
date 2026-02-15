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

  const plugin = await prisma.plugin.findFirst({
    where: {
      id,
      OR: [{ userId: session.user.id }, { isGlobal: true }],
    },
    include: {
      tools: { include: { tool: true } },
      skills: { include: { skill: true } },
      mcpServers: { include: { mcpServer: true } },
    },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...plugin,
    createdAt: plugin.createdAt.toISOString(),
    updatedAt: plugin.updatedAt.toISOString(),
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
  const body = await req.json();

  const plugin = await prisma.plugin.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.plugin.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.iconColor !== undefined && { iconColor: body.iconColor }),
      ...(body.version !== undefined && { version: body.version }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
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

  const plugin = await prisma.plugin.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.plugin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
