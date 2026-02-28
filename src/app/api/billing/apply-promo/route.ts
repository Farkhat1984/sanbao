import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { code, planId } = await req.json();
  if (!code || typeof code !== "string") {
    return jsonError("Промокод обязателен", 400);
  }

  const upperCode = code.toUpperCase().trim();
  if (upperCode.length > 50) {
    return jsonError("Некорректный промокод", 400);
  }

  // Atomic increment + plan validation in a single transaction
  // Prevents race where increment succeeds but rollback fails
  const now = new Date();

  const txResult = await prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1
      WHERE code = ${upperCode}
        AND "isActive" = true
        AND ("validUntil" IS NULL OR "validUntil" >= ${now})
        AND ("maxUses" = 0 OR "usedCount" < "maxUses")
    `;

    if (claimed === 0) {
      return { error: true as const, claimed: 0 };
    }

    const promo = await tx.promoCode.findUnique({ where: { code: upperCode } });

    // Validate plan restriction inside the same transaction
    if (promo?.planId && planId && promo.planId !== planId) {
      // Rollback within same transaction — guaranteed atomic
      await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usedCount" = GREATEST("usedCount" - 1, 0)
        WHERE code = ${upperCode}
      `;
      return { error: true as const, planMismatch: true };
    }

    return { error: false as const, promo };
  });

  if (txResult.error) {
    if ("planMismatch" in txResult && txResult.planMismatch) {
      return jsonError("Промокод не применим к выбранному тарифу", 400);
    }
    // Determine why it failed for a better error message
    const promo = await prisma.promoCode.findUnique({ where: { code: upperCode } });
    if (!promo) {
      return jsonError("Промокод не найден", 404);
    }
    if (!promo.isActive) {
      return jsonError("Промокод неактивен", 400);
    }
    if (promo.validUntil && now > promo.validUntil) {
      return jsonError("Промокод истёк", 400);
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return jsonError("Промокод исчерпан", 400);
    }
    return jsonError("Не удалось применить промокод", 400);
  }

  return jsonOk({
    discount: txResult.promo?.discount ?? 0,
    code: upperCode,
    planId: txResult.promo?.planId ?? null,
  });
}
