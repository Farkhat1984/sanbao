import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";
import { encrypt } from "@/lib/crypto";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const provider = await prisma.aiProvider.findUnique({
    where: { id },
    include: { models: { orderBy: { displayName: "asc" } } },
  });

  if (!provider) {
    return jsonError("Провайдер не найден", 404);
  }

  return jsonOk({
    ...provider,
    apiKey: provider.apiKey ? `${provider.apiKey.slice(0, 8)}...${provider.apiKey.slice(-4)}` : "",
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) {
    return jsonError("Провайдер не найден", 404);
  }

  // SSRF protection on provider base URL
  if (body.baseUrl && !isUrlSafe(body.baseUrl)) {
    return jsonError("Недопустимый baseUrl: приватные и локальные адреса запрещены", 400);
  }

  const allowedFields = ["name", "slug", "baseUrl", "apiKey", "isActive", "priority", "apiFormat"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = field === "apiKey" ? encrypt(body[field]) : body[field];
    }
  }

  const updated = await prisma.aiProvider.update({ where: { id }, data });
  invalidateModelCache();

  return jsonOk({
    ...updated,
    apiKey: updated.apiKey ? `${updated.apiKey.slice(0, 8)}...${updated.apiKey.slice(-4)}` : "",
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) {
    return jsonError("Провайдер не найден", 404);
  }

  await prisma.aiProvider.delete({ where: { id } });
  invalidateModelCache();

  return jsonOk({ success: true });
}
