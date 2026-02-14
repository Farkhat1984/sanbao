import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const { status, resolution } = await req.json();

  const report = await prisma.contentReport.update({
    where: { id },
    data: {
      status,
      resolution: resolution || null,
      resolvedBy: result.userId,
    },
  });

  return NextResponse.json(report);
}
