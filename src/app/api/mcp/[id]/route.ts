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

  const server = await prisma.mcpServer.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!server) {
    return NextResponse.json({ error: "Не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...server,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
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

  const existing = await prisma.mcpServer.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Не найден" }, { status: 404 });
  }

  const server = await prisma.mcpServer.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.url !== undefined && { url: body.url.trim() }),
      ...(body.transport !== undefined && { transport: body.transport }),
      ...(body.apiKey !== undefined && { apiKey: body.apiKey?.trim() || null }),
    },
  });

  return NextResponse.json({
    ...server,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
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

  const existing = await prisma.mcpServer.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Не найден" }, { status: 404 });
  }

  await prisma.mcpServer.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
