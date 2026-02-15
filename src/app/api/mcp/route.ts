import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch user's own servers + enabled global servers
  const [userServers, globalServers, userLinks] = await Promise.all([
    prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mcpServer.findMany({
      where: { isGlobal: true, isEnabled: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userMcpServer.findMany({
      where: { userId },
      select: { mcpServerId: true, isActive: true },
    }),
  ]);

  // Build a map of user's active global MCP choices
  const userLinkMap = new Map(userLinks.map((l) => [l.mcpServerId, l.isActive]));

  const result = [
    ...globalServers.map((s) => ({
      ...s,
      apiKey: null, // hide global server API keys from users
      isGlobal: true,
      userActive: userLinkMap.get(s.id) ?? false, // not active until user opts in
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    ...userServers.map((s) => ({
      ...s,
      isGlobal: false,
      userActive: true, // user's own servers are always active
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  ];

  return NextResponse.json(result);
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
    isGlobal: false,
    userActive: true,
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  });
}
