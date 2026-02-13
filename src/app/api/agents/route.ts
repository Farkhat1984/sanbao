import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      iconColor: true,
      model: true,
      updatedAt: true,
      _count: { select: { conversations: true, files: true } },
    },
  });

  const result = agents.map((a) => ({
    ...a,
    updatedAt: a.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, instructions, model, icon, iconColor } = body;

  if (!name?.trim() || !instructions?.trim()) {
    return NextResponse.json(
      { error: "Название и инструкции обязательны" },
      { status: 400 }
    );
  }

  const agent = await prisma.agent.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      instructions: instructions.trim(),
      model: model || "openai",
      icon: icon || "Bot",
      iconColor: iconColor || "#4F6EF7",
    },
    include: { files: true },
  });

  return NextResponse.json({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    files: [],
  });
}
