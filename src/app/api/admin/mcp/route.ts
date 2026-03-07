import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const servers = await prisma.mcpServer.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return jsonOk(servers);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, url, transport, apiKey } = body;

  if (!name || !url) {
    return jsonError("Обязательные поля: name, url", 400);
  }

  // SSRF protection: block internal/private URLs
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return jsonError("URL должен использовать http или https", 400);
    }
    const BLOCKED_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1?\]|metadata\.google|169\.254\.\d+\.\d+)/i;
    if (BLOCKED_HOSTS.test(parsed.hostname)) {
      return jsonError("URL указывает на внутреннюю сеть", 400);
    }
  } catch {
    return jsonError("Некорректный URL", 400);
  }

  const server = await prisma.mcpServer.create({
    data: {
      name,
      url,
      transport: transport || "STREAMABLE_HTTP",
      apiKey: apiKey || null,
      isGlobal: true,
      isEnabled: body.isEnabled !== false,
      userId: null,
    },
  });

  return jsonOk(server, 201);
}
