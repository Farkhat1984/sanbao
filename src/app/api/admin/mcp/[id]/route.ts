import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const server = await prisma.mcpServer.findUnique({ where: { id } });
  if (!server || !server.isGlobal) {
    return jsonError("Сервер не найден", 404);
  }

  const allowedFields = ["name", "url", "transport", "apiKey", "status", "isEnabled"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  if (typeof data.url === "string" && !isUrlSafe(data.url)) {
    return jsonError("URL заблокирован (SSRF protection)", 400);
  }

  const updated = await prisma.mcpServer.update({ where: { id }, data });
  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const server = await prisma.mcpServer.findUnique({ where: { id } });
  if (!server || !server.isGlobal) {
    return jsonError("Сервер не найден", 404);
  }

  await prisma.mcpServer.delete({ where: { id } });
  return jsonOk({ success: true });
}
