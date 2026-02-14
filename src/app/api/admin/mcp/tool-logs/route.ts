import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");
  const toolName = searchParams.get("toolName");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (serverId) where.mcpServerId = serverId;
  if (toolName) where.toolName = { contains: toolName, mode: "insensitive" };

  const [logs, total] = await Promise.all([
    prisma.mcpToolLog.findMany({
      where,
      include: { mcpServer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mcpToolLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
