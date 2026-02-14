import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await prisma.userMemory.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const result = memories.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key, content, source } = await req.json();

  if (!key?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "Ключ и содержимое обязательны" },
      { status: 400 }
    );
  }

  const memory = await prisma.userMemory.upsert({
    where: {
      userId_key: { userId: session.user.id, key: key.trim() },
    },
    create: {
      userId: session.user.id,
      key: key.trim(),
      content: content.trim(),
      source: source || "manual",
    },
    update: {
      content: content.trim(),
      source: source || "manual",
    },
  });

  return NextResponse.json({
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  });
}
