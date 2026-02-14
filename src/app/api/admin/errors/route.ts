import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
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

    const header = "Date,Route,Method,Message,UserId\n";
    const rows = allErrors.map((e) =>
      `${e.createdAt.toISOString()},${e.route},${e.method},"${e.message.replace(/"/g, '""')}",${e.userId || ""}`
    ).join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="errors-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
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
