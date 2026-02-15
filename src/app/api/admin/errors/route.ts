import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildCsvDocument, csvResponse } from "@/lib/csv-utils";
import { parsePagination } from "@/lib/validation";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const route = searchParams.get("route");

  const format = searchParams.get("format");
  const where: Record<string, unknown> = {};
  if (route) where.route = { contains: route };

  // CSV export
  if (format === "csv") {
    const csvLimit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 50000);
    const allErrors = await prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: csvLimit,
    });

    const csv = buildCsvDocument(
      ["Date", "Route", "Method", "Message", "UserId"],
      allErrors.map((e) => [e.createdAt.toISOString(), e.route, e.method, e.message, e.userId || ""])
    );
    return csvResponse(csv, `errors-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const [errors, total] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.errorLog.count({ where }),
  ]);

  return NextResponse.json({ errors, total, page, limit });
}
