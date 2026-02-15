import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildCsvDocument, csvResponse } from "@/lib/csv-utils";
import { parsePagination } from "@/lib/validation";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { page, limit } = parsePagination(searchParams);

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
  }

  const format = searchParams.get("format");

  // CSV export
  if (format === "csv") {
    const csvLimit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 50000);
    const allLogs = await prisma.tokenLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: csvLimit,
    });

    const csv = buildCsvDocument(
      ["Date", "UserId", "Provider", "Model", "InputTokens", "OutputTokens", "Cost"],
      allLogs.map((l) => [l.createdAt.toISOString(), l.userId, l.provider, l.model, l.inputTokens, l.outputTokens, l.cost])
    );
    return csvResponse(csv, `token-usage-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const [logs, total] = await Promise.all([
    prisma.tokenLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tokenLog.count({ where }),
  ]);

  // Aggregates
  const agg = await prisma.tokenLog.aggregate({
    where,
    _sum: { inputTokens: true, outputTokens: true, cost: true },
  });

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    totals: {
      inputTokens: agg._sum.inputTokens || 0,
      outputTokens: agg._sum.outputTokens || 0,
      cost: agg._sum.cost || 0,
    },
  });
}
