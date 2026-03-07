import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { order } = await req.json();

  if (!Array.isArray(order) || order.length === 0 || order.length > 200) {
    return jsonError("order must be an array of IDs (max 200)", 400);
  }

  // Update sortOrder in a single transaction to avoid N+1
  await prisma.$transaction(
    order.map((id: string, index: number) =>
      prisma.agent.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return jsonOk({ success: true });
}
