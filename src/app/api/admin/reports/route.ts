import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { jsonOk } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const where = status
    ? { status: status as "PENDING" | "REVIEWED" | "ACTION_TAKEN" | "DISMISSED" }
    : undefined;

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.contentReport.count({ where }),
  ]);

  return jsonOk({ reports, total, page, limit });
}
