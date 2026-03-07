import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const tools = await prisma.tool.findMany({
    where: { isGlobal: true },
    orderBy: { sortOrder: "asc" },
    include: {
      agents: { include: { agent: { select: { id: true, name: true, isSystem: true } } } },
    },
  });

  return jsonOk(tools.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { name, description, icon, iconColor, type, config, inputSchema, sortOrder } = await req.json();

  if (!name?.trim()) {
    return jsonError("Название обязательно", 400);
  }

  const tool = await prisma.tool.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || "Wrench",
      iconColor: iconColor || "#8FAF9F",
      type: type || "PROMPT_TEMPLATE",
      config: config || {},
      inputSchema: inputSchema || null,
      isGlobal: true,
      sortOrder: sortOrder ?? 0,
    },
  });

  return jsonOk({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
  });
}
