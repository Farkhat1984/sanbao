import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

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

  const items = [
    ...globalServers.map((s) => ({
      ...serializeDates(s),
      apiKey: null, // hide global server API keys from users
      isGlobal: true,
      userActive: userLinkMap.get(s.id) ?? false,
    })),
    ...userServers.map((s) => ({
      ...serializeDates(s),
      isGlobal: false,
      userActive: true,
    })),
  ];

  return jsonOk(items);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { name, url, transport, apiKey } = body;

  if (!name?.trim() || !url?.trim()) {
    return jsonError("Название и URL обязательны", 400);
  }

  const server = await prisma.mcpServer.create({
    data: {
      userId,
      name: name.trim(),
      url: url.trim(),
      transport: transport || "STREAMABLE_HTTP",
      apiKey: apiKey?.trim() || null,
    },
  });

  return jsonOk({
    ...serializeDates(server),
    isGlobal: false,
    userActive: true,
  }, 201);
}
