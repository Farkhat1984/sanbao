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

  const tool = await prisma.tool.findFirst({
    where: {
      id,
      OR: [{ userId: session.user.id }, { isGlobal: true }],
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
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

  const tool = await prisma.tool.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.tool.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.iconColor !== undefined && { iconColor: body.iconColor }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.config !== undefined && { config: body.config }),
      ...(body.inputSchema !== undefined && { inputSchema: body.inputSchema }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
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

  const tool = await prisma.tool.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tool.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
