import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const experiments = await prisma.promptExperiment.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(experiments);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, key, variantA, variantB, trafficPct } = body;

  if (!name || !key || !variantA || !variantB) {
    return NextResponse.json({ error: "name, key, variantA, variantB required" }, { status: 400 });
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

  return NextResponse.json(experiment, { status: 201 });
}
