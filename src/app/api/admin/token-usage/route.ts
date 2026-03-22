import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildCsvDocument, csvResponse } from "@/lib/csv-utils";
import { parsePagination } from "@/lib/validation";
import { jsonOk } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

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

function defaultFrom(): Date {
  const d = new Date();
  d.setDate(1); // first day of current month
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const providerFilter = searchParams.get("provider");
  const modelFilter = searchParams.get("model");
  const { page, limit } = parsePagination(searchParams);

  const dateFrom = from ? new Date(from) : defaultFrom();
  const dateTo = to ? new Date(to) : new Date();

  const where: Prisma.TokenLogWhereInput = {
    ...(userId ? { userId } : {}),
    ...(providerFilter ? { provider: providerFilter } : {}),
    ...(modelFilter ? { model: { contains: modelFilter, mode: "insensitive" } } : {}),
    createdAt: { gte: dateFrom, lte: dateTo },
  };

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

  const [logs, total, agg, grouped] = await Promise.all([
    prisma.tokenLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tokenLog.count({ where }),
    prisma.tokenLog.aggregate({
      where,
      _sum: { inputTokens: true, outputTokens: true, cost: true },
    }),
    // Group by provider+model for revenue calc (DB-side aggregation, not full scan)
    prisma.tokenLog.groupBy({
      by: ["provider", "model"],
      where,
      _sum: { inputTokens: true, outputTokens: true, cost: true },
    }),
  ]);

  // Enrich individual logs with revenue & profit
  const enrichedLogs = logs.map((l) => {
    const revenue = calcRevenue(priceMap, l.provider, l.model, l.inputTokens, l.outputTokens);
    return { ...l, revenue, profit: revenue - l.cost };
  });

  // Compute total revenue from grouped aggregates (not full table scan)
  let totalRevenue = 0;
  let totalCost = 0;
  for (const g of grouped) {
    const inp = g._sum.inputTokens || 0;
    const out = g._sum.outputTokens || 0;
    totalRevenue += calcRevenue(priceMap, g.provider, g.model, inp, out);
    totalCost += g._sum.cost || 0;
  }

  // Distinct providers for filter dropdown
  const providers = [...new Set(grouped.map((g) => g.provider))].sort();

  return jsonOk({
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
    providers,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  });
}
