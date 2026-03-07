import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const reports = await prisma.contentReport.findMany({
    where: status ? { status: status as "PENDING" | "REVIEWED" | "ACTION_TAKEN" | "DISMISSED" } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return jsonOk(reports);
}
