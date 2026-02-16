import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";
import { encrypt } from "@/lib/crypto";
import { isUrlSafe } from "@/lib/ssrf";

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
    apiKey: p.apiKey ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : "",
  }));

  return NextResponse.json(masked);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, slug, baseUrl, apiKey, isActive, priority } = body;

  if (!name || !slug || !baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Обязательные поля: name, slug, baseUrl, apiKey" },
      { status: 400 }
    );
  }

  // SSRF protection on provider base URL
  if (!isUrlSafe(baseUrl)) {
    return NextResponse.json(
      { error: "Недопустимый baseUrl: приватные и локальные адреса запрещены" },
      { status: 400 }
    );
  }

  // Check uniqueness
  const existing = await prisma.aiProvider.findFirst({
    where: { OR: [{ name }, { slug }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Провайдер с таким именем или slug уже существует" },
      { status: 409 }
    );
  }

  const provider = await prisma.aiProvider.create({
    data: {
      name,
      slug,
      baseUrl,
      apiKey: encrypt(apiKey),
      isActive: isActive ?? true,
      priority: priority ?? 0,
    },
  });

  invalidateModelCache();

  return NextResponse.json(provider, { status: 201 });
}
