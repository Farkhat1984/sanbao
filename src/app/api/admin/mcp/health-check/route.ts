import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { connectAndDiscoverTools } from "@/lib/mcp-client";
import type { Prisma } from "@prisma/client";

/** POST — run health check + tool discovery for all global MCP servers (or specific id). */
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { serverId } = await req.json().catch(() => ({ serverId: null }));

  const where: Record<string, unknown> = { isGlobal: true };
  if (serverId) where.id = serverId;

  const servers = await prisma.mcpServer.findMany({ where });

  const results = await Promise.all(
    servers.map(async (server) => {
      const start = Date.now();
      try {
        const { tools, error } = await connectAndDiscoverTools(
          server.url,
          server.transport,
          server.apiKey
        );

        const latency = Date.now() - start;

        if (error) {
          await prisma.mcpServer.update({
            where: { id: server.id },
            data: {
              status: "ERROR",
              lastHealthCheck: new Date(),
            },
          });

          return { id: server.id, name: server.name, status: "ERROR", latency, error, toolCount: 0 };
        }

        await prisma.mcpServer.update({
          where: { id: server.id },
          data: {
            status: "CONNECTED",
            discoveredTools: tools as unknown as Prisma.InputJsonValue,
            lastHealthCheck: new Date(),
          },
        });

        return { id: server.id, name: server.name, status: "CONNECTED", latency, toolCount: tools.length };
      } catch (err) {
        const latency = Date.now() - start;
        await prisma.mcpServer.update({
          where: { id: server.id },
          data: {
            status: "ERROR",
            lastHealthCheck: new Date(),
          },
        });

        return {
          id: server.id,
          name: server.name,
          status: "ERROR",
          latency,
          error: err instanceof Error ? err.message : String(err),
          toolCount: 0,
        };
      }
    })
  );

  return NextResponse.json(results);
}
