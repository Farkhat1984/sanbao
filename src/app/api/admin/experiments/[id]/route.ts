import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateExperimentCache } from "@/lib/ab-experiment";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const experiment = await prisma.promptExperiment.update({
    where: { id },
    data: body,
  });

  invalidateExperimentCache();

  return NextResponse.json(experiment);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  await prisma.promptExperiment.delete({ where: { id } });
  invalidateExperimentCache();

  return NextResponse.json({ success: true });
}
