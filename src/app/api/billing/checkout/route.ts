import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
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

  const { planId, promoCode } = await req.json();

  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "План не найден" }, { status: 404 });
  }

  const priceNum = parseInt(plan.price.replace(/\D/g, ""), 10);
  if (!priceNum || priceNum <= 0) {
    return NextResponse.json({ error: "Бесплатный план не требует оплаты" }, { status: 400 });
  }

  // Apply promo code discount
  let finalAmount = priceNum * 100; // convert to tiyn/cents
  if (promoCode) {
    const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
    if (promo && promo.isActive && promo.discount > 0) {
      finalAmount = Math.round(finalAmount * (1 - promo.discount / 100));
    }
  }

  const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: session.user.id,
    metadata: { planSlug: plan.slug },
    line_items: [
      {
        price_data: {
          currency: "kzt",
          product_data: {
            name: `Leema — ${plan.name}`,
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
