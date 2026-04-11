import { prisma } from "@/lib/prisma";
import type { SubscriptionAction } from "@prisma/client";

interface LogSubscriptionChangeOptions {
  subscriptionId: string;
  userId: string;
  action: SubscriptionAction;
  fromPlanId?: string | null;
  toPlanId: string;
  expiresAt?: Date | null;
  reason?: string;
  performedBy?: string | null;
}

/**
 * Log a subscription change to SubscriptionHistory.
 * Should be called at every subscription mutation point.
 */
export async function logSubscriptionChange(opts: LogSubscriptionChangeOptions) {
  return prisma.subscriptionHistory.create({
    data: {
      subscriptionId: opts.subscriptionId,
      userId: opts.userId,
      action: opts.action,
      fromPlanId: opts.fromPlanId ?? null,
      toPlanId: opts.toPlanId,
      expiresAt: opts.expiresAt ?? null,
      reason: opts.reason,
      performedBy: opts.performedBy ?? null,
    },
  });
}
