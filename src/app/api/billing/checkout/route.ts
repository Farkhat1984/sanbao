import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { STRIPE_API_VERSION, DEFAULT_CURRENCY } from "@/lib/constants";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe не настроен" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }
  const { planId, promoCode } = body;

  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "План не найден" }, { status: 404 });
  }

  if (!plan.price || plan.price <= 0) {
    return NextResponse.json({ error: "Бесплатный план не требует оплаты" }, { status: 400 });
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
    return NextResponse.json({ error: "Origin or NEXTAUTH_URL must be configured" }, { status: 500 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: session.user.id,
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

  return NextResponse.json({ url: checkoutSession.url });
}
