import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subscriptions: true } } },
    take: 500,
  });

  return jsonOk(plans);
}
