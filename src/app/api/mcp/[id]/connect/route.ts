import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectAndDiscoverTools } from "@/lib/mcp-client";

export async function POST(
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

  const { tools, error } = await connectAndDiscoverTools(
    server.url,
    server.transport,
    server.apiKey
  );

  if (error) {
    await prisma.mcpServer.update({
      where: { id },
      data: { status: "ERROR", discoveredTools: undefined },
    });

    return NextResponse.json({ error, status: "ERROR" }, { status: 502 });
  }

  await prisma.mcpServer.update({
    where: { id },
    data: {
      status: "CONNECTED",
      discoveredTools: tools as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    status: "CONNECTED",
    tools,
    toolCount: tools.length,
  });
}
