import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail, sendPaymentFailedNotification } from "@/lib/invoice";
import Stripe from "stripe";
import { STRIPE_API_VERSION, DEFAULT_CURRENCY } from "@/lib/constants";

/**
 * Stripe webhook handler.
 * Processes payment events and updates subscriptions accordingly.
 * Validates Stripe signature when STRIPE_WEBHOOK_SECRET is configured.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: { type: string; data: { object: Record<string, unknown> } };

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (endpointSecret && sig) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: STRIPE_API_VERSION });
      const verified = stripe.webhooks.constructEvent(body, sig, endpointSecret) as unknown as typeof event;
      event = verified;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
    }
  } else {
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = obj.client_reference_id as string;
      const planSlug = (obj.metadata as Record<string, string>)?.planSlug;

      if (userId && planSlug) {
        const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
        if (plan) {
          await prisma.subscription.upsert({
            where: { userId },
            update: { planId: plan.id },
            create: { userId, planId: plan.id },
          });

          await prisma.payment.create({
            data: {
              userId,
              amount: (obj.amount_total as number) || 0,
              currency: (obj.currency as string) || DEFAULT_CURRENCY,
              status: "COMPLETED",
              provider: "stripe",
              externalId: obj.id as string,
            },
          });

          // Send invoice email (fire-and-forget)
          const amountTotal = (obj.amount_total as number) || 0;
          const currency = (obj.currency as string) || DEFAULT_CURRENCY;
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          sendInvoiceEmail({
            userId,
            planName: plan.name,
            amount: `${(amountTotal / 100).toLocaleString("ru-RU")} ${currency.toUpperCase()}`,
            periodStart: now,
            periodEnd,
          }).catch((err) => console.error("Invoice email error:", err));
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const customerId = obj.customer as string;
      // Log the failure
      await prisma.payment.create({
        data: {
          userId: customerId || "unknown",
          amount: (obj.amount_due as number) || 0,
          status: "FAILED",
          provider: "stripe",
          externalId: obj.id as string,
        },
      });

      // Send payment failed email (fire-and-forget)
      if (customerId) {
        const sub = await prisma.subscription.findUnique({
          where: { userId: customerId },
          include: { plan: { select: { name: true } } },
        });
        if (sub) {
          sendPaymentFailedNotification({
            userId: customerId,
            planName: sub.plan.name,
          }).catch((err) => console.error("Payment failed email error:", err));
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const customerId = obj.customer as string;
      if (customerId) {
        // Downgrade to free plan
        const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
        if (freePlan) {
          await prisma.subscription.updateMany({
            where: { userId: customerId },
            data: { planId: freePlan.id },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
