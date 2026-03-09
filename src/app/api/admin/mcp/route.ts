import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { isUrlSafe } from "@/lib/ssrf";

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
  if (!isUrlSafe(url.trim())) {
    return jsonError("URL указывает на внутреннюю сеть или некорректен", 400);
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
