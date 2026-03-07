import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return jsonOk(codes);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { code, description, discount, maxUses, validUntil, planId } = await req.json();

  if (!code || !discount) {
    return jsonError("code and discount required", 400);
  }

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    return jsonError("Промокод уже существует", 409);
  }

  const promo = await prisma.promoCode.create({
    data: {
      code: code.toUpperCase(),
      description: description || null,
      discount: Math.min(100, Math.max(0, discount)),
      maxUses: maxUses || 0,
      validUntil: validUntil ? new Date(validUntil) : null,
      planId: planId || null,
    },
  });

  return jsonOk(promo, 201);
}
