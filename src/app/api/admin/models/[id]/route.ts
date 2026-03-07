import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import type { ModelCategory } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const model = await prisma.aiModel.findUnique({
    where: { id },
    include: {
      provider: { select: { id: true, name: true, slug: true } },
      planModels: { include: { plan: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!model) {
    return jsonError("Модель не найдена", 404);
  }

  return jsonOk(model);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const model = await prisma.aiModel.findUnique({ where: { id } });
  if (!model) {
    return jsonError("Модель не найдена", 404);
  }

  const allowedFields = [
    "modelId", "displayName", "category", "temperature", "topP",
    "maxTokens", "contextWindow", "costPer1kInput", "costPer1kOutput",
    "pricePer1kInput", "pricePer1kOutput",
    "supportsThinking", "maxThinkingTokens", "isActive", "isDefault",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  // Atomic default swap + update in transaction
  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      const category = (data.category as ModelCategory) || model.category;
      await tx.aiModel.updateMany({
        where: { category, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return tx.aiModel.update({
      where: { id },
      data,
      include: { provider: { select: { id: true, name: true, slug: true } } },
    });
  });

  invalidateModelCache();

  return jsonOk(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  const model = await prisma.aiModel.findUnique({ where: { id } });
  if (!model) {
    return jsonError("Модель не найдена", 404);
  }

  await prisma.aiModel.delete({ where: { id } });
  invalidateModelCache();

  return jsonOk({ success: true });
}
