import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { order } = await req.json();

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "order must be an array of IDs" }, { status: 400 });
  }

  // Update sortOrder for each agent
  await Promise.all(
    order.map((id: string, index: number) =>
      prisma.systemAgent.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
