import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { isUrlSafe } from "@/lib/ssrf";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return jsonError("Вебхук не найден", 404);
  }

  // SSRF protection on URL update
  if (body.url !== undefined && !isUrlSafe(body.url.trim())) {
    return jsonError("URL указывает на внутреннюю сеть или некорректен", 400);
  }

  const allowedFields = ["url", "events", "isActive"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const updated = await prisma.webhook.update({ where: { id }, data });
  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return jsonError("Вебхук не найден", 404);
  }

  await prisma.webhook.delete({ where: { id } });
  return jsonOk({ success: true });
}
