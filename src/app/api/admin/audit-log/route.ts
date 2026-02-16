import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildCsvDocument, csvResponse } from "@/lib/csv-utils";
import { parsePagination } from "@/lib/validation";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const actor = searchParams.get("actor");
  const action = searchParams.get("action");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { page, limit } = parsePagination(searchParams);

  const where: Record<string, unknown> = {};
  if (actor) where.actorId = actor;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
  }

  const format = searchParams.get("format");

  // CSV export
  if (format === "csv") {
    const csvLimit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 10000);
    const allLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: csvLimit,
    });

    const csv = buildCsvDocument(
      ["Date", "ActorId", "Action", "Target", "TargetId", "IP"],
      allLogs.map((l) => [l.createdAt.toISOString(), l.actorId, l.action, l.target, l.targetId || "", l.ip || ""])
    );
    return csvResponse(csv, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
