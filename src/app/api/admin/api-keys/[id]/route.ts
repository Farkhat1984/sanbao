import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) {
    return jsonError("API-ключ не найден", 404);
  }

  const allowedFields = ["name", "isActive", "rateLimit", "expiresAt"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = field === "expiresAt" && body[field] ? new Date(body[field]) : body[field];
    }
  }

  const updated = await prisma.apiKey.update({ where: { id }, data });
  return jsonOk({ ...updated, key: `${updated.key.slice(0, 8)}...${updated.key.slice(-4)}` });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) {
    return jsonError("API-ключ не найден", 404);
  }

  await prisma.apiKey.delete({ where: { id } });
  return jsonOk({ success: true });
}
