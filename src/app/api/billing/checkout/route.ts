import { prisma } from "@/lib/prisma";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { getStripe } from "@/lib/stripe-client";

export async function POST(req: Request) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

  const stripe = getStripe();
  if (!stripe) {
    return jsonError("Stripe не настроен", 500);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return jsonError("Неверный JSON", 400);
  }
  const { planId, promoCode } = body;

  if (!planId) {
    return jsonError("planId required", 400);
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return jsonError("План не найден", 404);
  }

  if (!plan.price || plan.price <= 0) {
    return jsonError("Бесплатный план не требует оплаты", 400);
  }

  // Apply promo code discount (atomic increment to prevent unlimited reuse)
  let finalAmount = plan.price * 100; // convert to tiyn/cents
  if (promoCode) {
    const upperCode = (promoCode as string).toUpperCase().trim();
    const now = new Date();
    const claimed = await prisma.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1
      WHERE code = ${upperCode}
        AND "isActive" = true
        AND ("validUntil" IS NULL OR "validUntil" >= ${now})
        AND ("maxUses" = 0 OR "usedCount" < "maxUses")
    `;
    if (claimed > 0) {
      const promo = await prisma.promoCode.findUnique({ where: { code: upperCode } });
      if (promo && promo.isActive && promo.discount > 0) {
        finalAmount = Math.round(finalAmount * (1 - promo.discount / 100));
      }
    }
  }

  const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL;
  if (!origin) {
    return jsonError("Origin or NEXTAUTH_URL must be configured", 500);
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: userId,
    metadata: { planSlug: plan.slug },
    line_items: [
      {
        price_data: {
          currency: DEFAULT_CURRENCY.toLowerCase(),
          product_data: {
            name: `Sanbao — ${plan.name}`,
            description: plan.description || undefined,
          },
          unit_amount: finalAmount,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/settings?payment=success`,
    cancel_url: `${origin}/settings?payment=cancelled`,
  });

  return jsonOk({ url: checkoutSession.url });
}
