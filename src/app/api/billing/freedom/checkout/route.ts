import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { initPayment, isFreedomPayConfigured } from "@/lib/freedom-pay";

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  if (!isFreedomPayConfigured()) {
    return jsonError("Платёжная система не настроена", 503);
  }

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { planId, promoCode } = body;
  if (!planId) return jsonError("Не указан тарифный план", 400);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  const priceNum = plan ? parseInt(plan.price, 10) : 0;
  if (!plan || !priceNum || priceNum <= 0) {
    return jsonError("Тарифный план не найден или бесплатный", 400);
  }

  // Apply promo code discount (atomic increment to prevent unlimited reuse)
  let finalAmount = priceNum;
  let appliedPromo: string | null = null;
  if (promoCode && typeof promoCode === "string") {
    const upperCode = promoCode.toUpperCase().trim();
    const now = new Date();
    const claimed = await prisma.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1
      WHERE code = ${upperCode}
        AND "isActive" = true
        AND ("validUntil" IS NULL OR "validUntil" >= ${now})
        AND ("maxUses" = 0 OR "usedCount" < "maxUses")
        AND ("planId" IS NULL OR "planId" = ${planId})
    `;
    if (claimed > 0) {
      const promo = await prisma.promoCode.findUnique({ where: { code: upperCode } });
      if (promo && promo.discount > 0) {
        finalAmount = Math.round(priceNum * (1 - promo.discount / 100));
        appliedPromo = promo.code;
      }
    }
  }

  if (finalAmount <= 0) {
    return jsonError("Сумма после скидки равна нулю", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // Create pending payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount: finalAmount,
      currency: "KZT",
      status: "PENDING",
      provider: "freedom",
      metadata: { planId: plan.id, planName: plan.name, promoCode: appliedPromo, originalAmount: priceNum },
    },
  });

  // Init payment with Freedom Pay
  const payResult = await initPayment({
    orderId: payment.id,
    amount: finalAmount,
    description: `Подписка Sanbao — ${plan.name}`,
    userEmail: user?.email,
    userId,
  });

  if (!payResult.success) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", metadata: { error: payResult.error } },
    });
    return jsonError(payResult.error || "Ошибка инициализации платежа", 502);
  }

  // Save external payment ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: { externalId: payResult.paymentId },
  });

  return jsonOk({
    paymentId: payment.id,
    redirectUrl: payResult.redirectUrl,
  });
}
