import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildCsvDocument, csvResponse } from "@/lib/csv-utils";
import { parsePagination } from "@/lib/validation";

// Build a price lookup map from AiModel records: "providerSlug:modelId" → prices
async function buildPriceMap() {
  const models = await prisma.aiModel.findMany({
    select: {
      modelId: true,
      pricePer1kInput: true,
      pricePer1kOutput: true,
      provider: { select: { slug: true } },
    },
  });
  const map = new Map<string, { pricePer1kInput: number; pricePer1kOutput: number }>();
  for (const m of models) {
    map.set(`${m.provider.slug}:${m.modelId}`, {
      pricePer1kInput: m.pricePer1kInput,
      pricePer1kOutput: m.pricePer1kOutput,
    });
  }
  return map;
}

function calcRevenue(
  priceMap: Map<string, { pricePer1kInput: number; pricePer1kOutput: number }>,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  const prices = priceMap.get(`${provider}:${model}`);
  if (!prices) return 0;
  return (inputTokens / 1000) * prices.pricePer1kInput + (outputTokens / 1000) * prices.pricePer1kOutput;
}

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
  const priceMap = await buildPriceMap();

  // CSV export
  if (format === "csv") {
    const csvLimit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 10000);
    const allLogs = await prisma.tokenLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: csvLimit,
    });

    const csv = buildCsvDocument(
      ["Date", "UserId", "Provider", "Model", "InputTokens", "OutputTokens", "Cost", "Revenue", "Profit"],
      allLogs.map((l) => {
        const revenue = calcRevenue(priceMap, l.provider, l.model, l.inputTokens, l.outputTokens);
        return [l.createdAt.toISOString(), l.userId, l.provider, l.model, l.inputTokens, l.outputTokens, l.cost, revenue.toFixed(6), (revenue - l.cost).toFixed(6)];
      })
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

  // Enrich logs with revenue & profit
  const enrichedLogs = logs.map((l) => {
    const revenue = calcRevenue(priceMap, l.provider, l.model, l.inputTokens, l.outputTokens);
    return { ...l, revenue, profit: revenue - l.cost };
  });

  // Aggregates
  const agg = await prisma.tokenLog.aggregate({
    where,
    _sum: { inputTokens: true, outputTokens: true, cost: true },
  });

  // Compute total revenue from all matching logs
  const allForRevenue = await prisma.tokenLog.findMany({
    where,
    select: { provider: true, model: true, inputTokens: true, outputTokens: true, cost: true },
  });
  let totalRevenue = 0;
  let totalCost = 0;
  for (const l of allForRevenue) {
    totalRevenue += calcRevenue(priceMap, l.provider, l.model, l.inputTokens, l.outputTokens);
    totalCost += l.cost;
  }

  return NextResponse.json({
    logs: enrichedLogs,
    total,
    page,
    limit,
    totals: {
      inputTokens: agg._sum.inputTokens || 0,
      outputTokens: agg._sum.outputTokens || 0,
      cost: agg._sum.cost || 0,
      revenue: totalRevenue,
      profit: totalRevenue - totalCost,
    },
  });
}
