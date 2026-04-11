import { prisma } from "@/lib/prisma";
import { checkExpiringSubscriptions, sendSubscriptionExpiredEmail } from "@/lib/invoice";
import { logSubscriptionChange } from "@/lib/subscription-history";
import { invalidatePlanCache } from "@/lib/usage";
import { logger } from "@/lib/logger";

/**
 * Downgrade all subscriptions where expiresAt has passed.
 * Logs history and sends notification for each expired subscription.
 */
export async function expireSubscriptions() {
  const now = new Date();
  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });
  if (!defaultPlan) return { expired: 0 };

  // Find subscriptions to expire (need individual records for history logging)
  const expiring = await prisma.subscription.findMany({
    where: {
      expiresAt: { lt: now },
      planId: { not: defaultPlan.id },
    },
    include: { plan: { select: { name: true } } },
  });

  let expired = 0;
  for (const sub of expiring) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { planId: defaultPlan.id, expiresAt: null },
      });

      await logSubscriptionChange({
        subscriptionId: sub.id,
        userId: sub.userId,
        action: "EXPIRED",
        fromPlanId: sub.planId,
        toPlanId: defaultPlan.id,
        reason: `Подписка истекла ${sub.expiresAt?.toISOString()}`,
        performedBy: "system",
      });

      await invalidatePlanCache(sub.userId);

      // Send expiration email (don't await — fire-and-forget)
      sendSubscriptionExpiredEmail({
        userId: sub.userId,
        planName: sub.plan.name,
        reason: "истёк срок действия",
      }).catch((err) => logger.error("Failed to send expired email", { userId: sub.userId, error: err }));

      expired++;
    } catch (err) {
      logger.error("Failed to expire subscription", { subId: sub.id, error: err });
    }
  }

  return { expired };
}

/**
 * Downgrade all subscriptions where trialEndsAt has passed
 * (and there is no valid expiresAt extending the subscription).
 */
export async function expireTrials() {
  const now = new Date();
  const defaultPlan = await prisma.plan.findFirst({ where: { isDefault: true } });
  if (!defaultPlan) return { expired: 0 };

  const expiring = await prisma.subscription.findMany({
    where: {
      trialEndsAt: { lt: now },
      expiresAt: null,
      planId: { not: defaultPlan.id },
    },
    include: { plan: { select: { name: true } } },
  });

  let expired = 0;
  for (const sub of expiring) {
    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { planId: defaultPlan.id, trialEndsAt: null },
      });

      await logSubscriptionChange({
        subscriptionId: sub.id,
        userId: sub.userId,
        action: "TRIAL_EXPIRED",
        fromPlanId: sub.planId,
        toPlanId: defaultPlan.id,
        reason: `Пробный период истёк ${sub.trialEndsAt?.toISOString()}`,
        performedBy: "system",
      });

      await invalidatePlanCache(sub.userId);

      sendSubscriptionExpiredEmail({
        userId: sub.userId,
        planName: sub.plan.name,
        reason: "истёк пробный период",
      }).catch((err) => logger.error("Failed to send trial expired email", { userId: sub.userId, error: err }));

      expired++;
    } catch (err) {
      logger.error("Failed to expire trial", { subId: sub.id, error: err });
    }
  }

  return { expired };
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
