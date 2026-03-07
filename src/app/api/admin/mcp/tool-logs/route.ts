import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { jsonOk } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");
  const toolName = searchParams.get("toolName");
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (serverId) where.mcpServerId = serverId;
  if (toolName) where.toolName = { contains: toolName, mode: "insensitive" };

  const [logs, total] = await Promise.all([
    prisma.mcpToolLog.findMany({
      where,
      include: { mcpServer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.mcpToolLog.count({ where }),
  ]);

  return jsonOk({ logs, total, page, limit });
}
