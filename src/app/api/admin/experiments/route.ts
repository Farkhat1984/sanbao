import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const experiments = await prisma.promptExperiment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return jsonOk(experiments);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, key, variantA, variantB, trafficPct } = body;

  if (!name || !key || !variantA || !variantB) {
    return jsonError("name, key, variantA, variantB required", 400);
  }

  const experiment = await prisma.promptExperiment.create({
    data: {
      name,
      description: description || null,
      key,
      variantA,
      variantB,
      trafficPct: trafficPct ?? 50,
    },
  });

  return jsonOk(experiment, 201);
}
