import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { randomBytes } from "crypto";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { isUrlSafe } from "@/lib/ssrf";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const [webhooks, total] = await Promise.all([
    prisma.webhook.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.webhook.count(),
  ]);

  return jsonOk({ webhooks, total, page, limit });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { url, events, isActive } = body;

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return jsonError("Обязательные поля: url, events[]", 400);
  }

  // SSRF protection: block internal/private URLs
  if (!isUrlSafe(url.trim())) {
    return jsonError("URL указывает на внутреннюю сеть или некорректен", 400);
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const webhook = await prisma.webhook.create({
    data: {
      url,
      events,
      secret,
      isActive: isActive ?? true,
    },
  });

  return jsonOk(webhook, 201);
}
