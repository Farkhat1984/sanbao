import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail, sendPaymentFailedNotification } from "@/lib/invoice";
import Stripe from "stripe";
import { STRIPE_API_VERSION, DEFAULT_CURRENCY } from "@/lib/constants";
import { fireAndForget } from "@/lib/logger";
import { invalidatePlanCache } from "@/lib/usage";

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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: STRIPE_API_VERSION });

  if (endpointSecret && sig) {
    try {
      const verified = stripe.webhooks.constructEvent(body, sig, endpointSecret) as unknown as typeof event;
      event = verified;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
    }
  } else if (!endpointSecret) {
    // Reject unsigned webhooks — STRIPE_WEBHOOK_SECRET must be configured
    console.warn("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  } else {
    // endpointSecret set but no signature header
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!event?.data?.object) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
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

          // Invalidate plan cache so the user sees their new plan immediately
          await invalidatePlanCache(userId);

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

          const invoicePromise = sendInvoiceEmail({
            userId,
            planName: plan.name,
            amount: `${(amountTotal / 100).toLocaleString("ru-RU")} ${currency.toUpperCase()}`,
            periodStart: now,
            periodEnd,
          });
          fireAndForget(invoicePromise, "billing:sendInvoiceEmail");
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      // Resolve user by Stripe customer email (customerId is Stripe's cus_xxx, NOT our userId)
      const stripeCustomerId = obj.customer as string;
      const customerEmail = obj.customer_email as string | undefined;
      let failedUserId: string | null = null;

      if (customerEmail) {
        const user = await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true } });
        failedUserId = user?.id ?? null;
      }
      if (!failedUserId && stripeCustomerId) {
        try {
          const customer = await stripe.customers.retrieve(stripeCustomerId);
          if (!("deleted" in customer && customer.deleted) && customer.email) {
            const user = await prisma.user.findUnique({ where: { email: customer.email }, select: { id: true } });
            failedUserId = user?.id ?? null;
          }
        } catch { /* Stripe API lookup failed — skip */ }
      }

      if (failedUserId) {
        await prisma.payment.create({
          data: {
            userId: failedUserId,
            amount: (obj.amount_due as number) || 0,
            status: "FAILED",
            provider: "stripe",
            externalId: obj.id as string,
          },
        });

        const sub = await prisma.subscription.findUnique({
          where: { userId: failedUserId },
          include: { plan: { select: { name: true } } },
        });
        if (sub) {
          const failedNotifPromise = sendPaymentFailedNotification({
            userId: failedUserId,
            planName: sub.plan.name,
          });
          fireAndForget(failedNotifPromise, "billing:sendPaymentFailedNotification");
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Resolve user by Stripe customer (customerId is Stripe's cus_xxx, NOT our userId)
      const stripeCustomerId = obj.customer as string;
      if (!stripeCustomerId) break;

      let deletedUserId: string | null = null;
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (!("deleted" in customer && customer.deleted) && customer.email) {
          const user = await prisma.user.findUnique({ where: { email: customer.email }, select: { id: true } });
          deletedUserId = user?.id ?? null;
        }
      } catch { /* Stripe API lookup failed — skip */ }

      if (deletedUserId) {
        const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
        if (freePlan) {
          await prisma.subscription.updateMany({
            where: { userId: deletedUserId },
            data: { planId: freePlan.id },
          });
          await invalidatePlanCache(deletedUserId);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
