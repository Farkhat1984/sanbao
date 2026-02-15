import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/** POST — run health check for all global MCP servers (or specific id). */
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const headers: Record<string, string> = {};
        if (server.apiKey) headers["Authorization"] = `Bearer ${server.apiKey}`;

        let res: Response;

        if (server.transport === "STREAMABLE_HTTP") {
          // Streamable HTTP: send JSON-RPC initialize request
          headers["Content-Type"] = "application/json";
          res = await fetch(server.url, {
            method: "POST",
            signal: controller.signal,
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "sanbao-healthcheck", version: "1.0.0" },
              },
            }),
          });
        } else {
          // SSE: simple GET to check endpoint is alive
          res = await fetch(server.url, {
            method: "GET",
            signal: controller.signal,
            headers,
          });
        }
        clearTimeout(timeout);

        const latency = Date.now() - start;
        const newStatus = res.ok ? "CONNECTED" : "ERROR";

        await prisma.mcpServer.update({
          where: { id: server.id },
          data: {
            status: newStatus as "CONNECTED" | "ERROR",
            lastHealthCheck: new Date(),
          },
        });

        return { id: server.id, name: server.name, status: newStatus, latency, statusCode: res.status };
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
        };
      }
    })
  );

  return NextResponse.json(results);
}
