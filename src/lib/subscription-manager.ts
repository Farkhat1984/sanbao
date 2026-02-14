import { prisma } from "@/lib/prisma";
import { checkExpiringSubscriptions } from "@/lib/invoice";

/**
 * Downgrade all subscriptions where expiresAt has passed.
 */
export async function expireSubscriptions() {
  const now = new Date();
  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });
  if (!defaultPlan) return { expired: 0 };

  const result = await prisma.subscription.updateMany({
    where: {
      expiresAt: { lt: now },
      planId: { not: defaultPlan.id },
    },
    data: { planId: defaultPlan.id },
  });

  return { expired: result.count };
}

/**
 * Downgrade all subscriptions where trialEndsAt has passed
 * (and there is no valid expiresAt extending the subscription).
 */
export async function expireTrials() {
  const now = new Date();
  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });
  if (!defaultPlan) return { expired: 0 };

  const result = await prisma.subscription.updateMany({
    where: {
      trialEndsAt: { lt: now },
      expiresAt: null,
      planId: { not: defaultPlan.id },
    },
    data: { planId: defaultPlan.id },
  });

  return { expired: result.count };
}

/**
 * Run all subscription maintenance tasks:
 * 1. Expire subscriptions past expiresAt
 * 2. Expire trials past trialEndsAt
 * 3. Send reminders for subscriptions expiring soon
 */
export async function runSubscriptionMaintenance() {
  const [subscriptions, trials, reminders] = await Promise.all([
    expireSubscriptions(),
    expireTrials(),
    checkExpiringSubscriptions(),
  ]);

  return {
    expiredSubscriptions: subscriptions.expired,
    expiredTrials: trials.expired,
    reminders,
  };
}
