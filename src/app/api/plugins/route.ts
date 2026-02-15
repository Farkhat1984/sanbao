import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plugins = await prisma.plugin.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { isGlobal: true },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
    include: {
      tools: { include: { tool: { select: { id: true, name: true, icon: true } } } },
      skills: { include: { skill: { select: { id: true, name: true, icon: true } } } },
      mcpServers: { include: { mcpServer: { select: { id: true, name: true, status: true } } } },
    },
  });

  return NextResponse.json(plugins.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, icon, iconColor, version } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  const plugin = await prisma.plugin.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "Puzzle",
      iconColor: iconColor || "#4F6EF7",
      version: version || "1.0.0",
    },
  });

  return NextResponse.json({
    ...plugin,
    createdAt: plugin.createdAt.toISOString(),
    updatedAt: plugin.updatedAt.toISOString(),
  });
}
