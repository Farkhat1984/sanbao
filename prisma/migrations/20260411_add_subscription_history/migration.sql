-- CreateEnum
CREATE TYPE "SubscriptionAction" AS ENUM ('ACTIVATED', 'RENEWED', 'EXPIRED', 'TRIAL_EXPIRED', 'CANCELLED', 'REFUNDED', 'DOWNGRADED', 'UPGRADED');

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'SUBSCRIPTION_ACTIVATED';
ALTER TYPE "EmailType" ADD VALUE 'SUBSCRIPTION_EXPIRED';

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "SubscriptionAction" NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionHistory_userId_createdAt_idx" ON "SubscriptionHistory"("userId", "createdAt");
CREATE INDEX "SubscriptionHistory_subscriptionId_createdAt_idx" ON "SubscriptionHistory"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionHistory_action_idx" ON "SubscriptionHistory"("action");

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
