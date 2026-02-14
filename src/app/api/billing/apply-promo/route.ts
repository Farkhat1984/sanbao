import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Промокод обязателен" }, { status: 400 });
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!promo) {
    return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
  }

  if (!promo.isActive) {
    return NextResponse.json({ error: "Промокод неактивен" }, { status: 400 });
  }

  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ error: "Промокод исчерпан" }, { status: 400 });
  }

  if (promo.validUntil && new Date() > promo.validUntil) {
    return NextResponse.json({ error: "Промокод истёк" }, { status: 400 });
  }

  // Increment usage
  await prisma.promoCode.update({
    where: { id: promo.id },
    data: { usedCount: { increment: 1 } },
  });

  return NextResponse.json({
    discount: promo.discount,
    code: promo.code,
    planId: promo.planId,
  });
}
