import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_PLUGIN_ICON } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const plugins = await prisma.plugin.findMany({
    where: {
      OR: [
        { userId },
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

  return jsonOk(plugins.map(serializeDates));
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { name, description, icon, iconColor, version } = body;

  if (!name?.trim()) {
    return jsonError("Название обязательно", 400);
  }

  const plugin = await prisma.plugin.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || DEFAULT_PLUGIN_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
      version: version || "1.0.0",
    },
  });

  return jsonOk(serializeDates(plugin), 201);
}
