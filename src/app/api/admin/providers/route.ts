import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";
import { encrypt } from "@/lib/crypto";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const providers = await prisma.aiProvider.findMany({
    orderBy: { priority: "desc" },
    include: { _count: { select: { models: true } } },
    take: 500,
  });

  // Mask API keys in response
  const masked = providers.map((p) => ({
    ...p,
    apiKey: p.apiKey ? `***${p.apiKey.slice(-4)}` : "",
  }));

  return jsonOk(masked);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, slug, baseUrl, apiKey, isActive, priority, apiFormat } = body;

  if (!name || !slug || !baseUrl || !apiKey) {
    return jsonError("Обязательные поля: name, slug, baseUrl, apiKey", 400);
  }

  // SSRF protection on provider base URL
  if (!isUrlSafe(baseUrl)) {
    return jsonError("Недопустимый baseUrl: приватные и локальные адреса запрещены", 400);
  }

  // Check uniqueness
  const existing = await prisma.aiProvider.findFirst({
    where: { OR: [{ name }, { slug }] },
  });
  if (existing) {
    return jsonError("Провайдер с таким именем или slug уже существует", 409);
  }

  const provider = await prisma.aiProvider.create({
    data: {
      name,
      slug,
      baseUrl,
      apiKey: encrypt(apiKey),
      isActive: isActive ?? true,
      priority: priority ?? 0,
      ...(apiFormat ? { apiFormat } : {}),
    },
  });

  invalidateModelCache();

  return jsonOk(provider, 201);
}
