import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";

/** GET — full matrix: all plans × all models with PlanModel links. */
export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const [plans, models, planModels] = await Promise.all([
    prisma.plan.findMany({ select: { id: true, name: true, slug: true }, orderBy: { sortOrder: "asc" }, take: 500 }),
    prisma.aiModel.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, category: true, provider: { select: { name: true } } },
      orderBy: [{ category: "asc" }, { displayName: "asc" }],
      take: 500,
    }),
    prisma.planModel.findMany({ take: 500 }),
  ]);

  return NextResponse.json({ plans, models, planModels });
}

/** POST — toggle model access for a plan. */
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { planId, modelId, action, isDefault } = await req.json();

  if (!planId || !modelId || !action) {
    return NextResponse.json({ error: "planId, modelId, action required" }, { status: 400 });
  }

  if (action === "add") {
    const existing = await prisma.planModel.findUnique({
      where: { planId_modelId: { planId, modelId } },
    });
    if (!existing) {
      await prisma.planModel.create({ data: { planId, modelId, isDefault: isDefault ?? false } });
    }
  } else if (action === "remove") {
    await prisma.planModel.deleteMany({ where: { planId, modelId } });
  } else if (action === "setDefault") {
    // Unset other defaults for this plan in the same category
    const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
    if (model) {
      const modelsInCategory = await prisma.aiModel.findMany({
        where: { category: model.category },
        select: { id: true },
      });
      await prisma.planModel.updateMany({
        where: { planId, modelId: { in: modelsInCategory.map((m) => m.id) } },
        data: { isDefault: false },
      });
      await prisma.planModel.updateMany({
        where: { planId, modelId },
        data: { isDefault: true },
      });
    }
  }

  invalidateModelCache();
  return NextResponse.json({ success: true });
}
