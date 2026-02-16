import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";

const VALID_CATEGORIES = ["TEXT", "IMAGE", "VOICE", "VIDEO", "CODE", "EMBEDDING"];

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const providerId = searchParams.get("providerId");

  const where: Record<string, unknown> = {};
  if (category && VALID_CATEGORIES.includes(category)) {
    where.category = category;
  }
  if (providerId) {
    where.providerId = providerId;
  }

  const models = await prisma.aiModel.findMany({
    where,
    include: {
      provider: { select: { id: true, name: true, slug: true } },
      _count: { select: { planModels: true } },
    },
    orderBy: [{ category: "asc" }, { displayName: "asc" }],
  });

  return NextResponse.json(models);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const {
    providerId,
    modelId,
    displayName,
    category,
    temperature,
    topP,
    maxTokens,
    contextWindow,
    costPer1kInput,
    costPer1kOutput,
    supportsThinking,
    maxThinkingTokens,
    isActive,
    isDefault,
  } = body;

  if (!providerId || !modelId || !displayName || !category) {
    return NextResponse.json(
      { error: "Обязательные поля: providerId, modelId, displayName, category" },
      { status: 400 }
    );
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Допустимые категории: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Provider must exist
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  // Unique check
  const existing = await prisma.aiModel.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Модель с таким modelId уже существует у этого провайдера" },
      { status: 409 }
    );
  }

  // Atomic default swap + create in transaction to prevent race conditions
  const model = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.aiModel.updateMany({
        where: { category: category, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.aiModel.create({
      data: {
        providerId,
        modelId,
        displayName,
        category,
        temperature: temperature ?? null,
        topP: topP ?? null,
        maxTokens: maxTokens ?? null,
        contextWindow: contextWindow ?? null,
        costPer1kInput: costPer1kInput ?? 0,
        costPer1kOutput: costPer1kOutput ?? 0,
        supportsThinking: supportsThinking ?? false,
        maxThinkingTokens: maxThinkingTokens || null,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
      },
      include: { provider: { select: { id: true, name: true, slug: true } } },
    });
  });

  invalidateModelCache();

  return NextResponse.json(model, { status: 201 });
}
