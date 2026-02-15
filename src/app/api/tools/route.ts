import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tools = await prisma.tool.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { isGlobal: true },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(tools.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, icon, iconColor, type, config, inputSchema } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  const tool = await prisma.tool.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "Wrench",
      iconColor: iconColor || "#4F6EF7",
      type: type || "PROMPT_TEMPLATE",
      config: config || {},
      inputSchema: inputSchema || null,
    },
  });

  return NextResponse.json({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
  });
}
