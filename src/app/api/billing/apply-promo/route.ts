import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, planId } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Промокод обязателен" }, { status: 400 });
  }

  const upperCode = code.toUpperCase().trim();
  if (upperCode.length > 50) {
    return NextResponse.json({ error: "Некорректный промокод" }, { status: 400 });
  }

  // Atomic conditional update: increment usedCount only if promo is valid and not exhausted.
  // Uses raw SQL to compare usedCount < maxUses in a single atomic operation,
  // preventing TOCTOU race conditions from concurrent requests.
  const now = new Date();

  const result = await prisma.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" + 1
    WHERE code = ${upperCode}
      AND "isActive" = true
      AND ("validUntil" IS NULL OR "validUntil" >= ${now})
      AND ("maxUses" = 0 OR "usedCount" < "maxUses")
  `;

  if (result === 0) {
    // Determine why it failed for a better error message
    const promo = await prisma.promoCode.findUnique({
      where: { code: upperCode },
    });
    if (!promo) {
      return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
    }
    if (!promo.isActive) {
      return NextResponse.json({ error: "Промокод неактивен" }, { status: 400 });
    }
    if (promo.validUntil && now > promo.validUntil) {
      return NextResponse.json({ error: "Промокод истёк" }, { status: 400 });
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ error: "Промокод исчерпан" }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось применить промокод" }, { status: 400 });
  }

  // Fetch the promo to return discount info
  const promo = await prisma.promoCode.findUnique({
    where: { code: upperCode },
  });

  // Validate plan restriction: if promo is tied to a specific plan, reject mismatches
  if (promo?.planId && planId && promo.planId !== planId) {
    // Rollback the usedCount increment since the promo doesn't apply
    await prisma.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = GREATEST("usedCount" - 1, 0)
      WHERE code = ${upperCode}
    `;
    return NextResponse.json({ error: "Промокод не применим к выбранному тарифу" }, { status: 400 });
  }

  return NextResponse.json({
    discount: promo?.discount ?? 0,
    code: upperCode,
    planId: promo?.planId ?? null,
  });
}
