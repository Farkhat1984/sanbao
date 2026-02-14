import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.mcpServer.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    servers.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, url, transport, apiKey } = await req.json();

  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json(
      { error: "Название и URL обязательны" },
      { status: 400 }
    );
  }

  const server = await prisma.mcpServer.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      url: url.trim(),
      transport: transport || "SSE",
      apiKey: apiKey?.trim() || null,
    },
  });

  return NextResponse.json({
    ...server,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  });
}
