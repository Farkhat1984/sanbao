import { prisma } from "@/lib/prisma";
import { sendEmail, invoiceEmail, subscriptionExpiringEmail, paymentFailedEmail } from "@/lib/email";

// ─── Invoice number generation ──────────────────────────

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

// ─── Send invoice after payment ─────────────────────────

export async function sendInvoiceEmail(opts: {
  userId: string;
  planName: string;
  amount: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true },
  });

  if (!user) return false;

  const invoiceNumber = generateInvoiceNumber();

  const formatDate = (d: Date) =>
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  const period = `${formatDate(opts.periodStart)} — ${formatDate(opts.periodEnd)}`;

  const { subject, html } = await invoiceEmail({
    userName: user.name || "Пользователь",
    planName: opts.planName,
    amount: opts.amount,
    period,
    invoiceNumber,
  });

  return sendEmail({
    to: user.email,
    subject,
    html,
    type: "INVOICE",
    userId: opts.userId,
    metadata: { invoiceNumber, planName: opts.planName, amount: opts.amount },
  });
}

// ─── Subscription expiring reminder ─────────────────────

export async function sendExpiringReminder(opts: {
  userId: string;
  planName: string;
  expiresAt: Date;
}) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true },
  });

  if (!user) return false;

  const formatDate = (d: Date) =>
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

  const { subject, html } = await subscriptionExpiringEmail({
    userName: user.name || "Пользователь",
    planName: opts.planName,
    expiresAt: formatDate(opts.expiresAt),
  });

  return sendEmail({
    to: user.email,
    subject,
    html,
    type: "SUBSCRIPTION_EXPIRING",
    userId: opts.userId,
  });
}

// ─── Payment failed notification ────────────────────────

export async function sendPaymentFailedNotification(opts: {
  userId: string;
  planName: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true },
  });

  if (!user) return false;

  const { subject, html } = await paymentFailedEmail({
    userName: user.name || "Пользователь",
    planName: opts.planName,
  });

  return sendEmail({
    to: user.email,
    subject,
    html,
    type: "PAYMENT_FAILED",
    userId: opts.userId,
  });
}

// ─── Check expiring subscriptions (cron-like) ───────────

export async function checkExpiringSubscriptions() {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiring = await prisma.subscription.findMany({
    where: {
      expiresAt: {
        gte: today,
        lte: threeDaysFromNow,
      },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      plan: { select: { name: true } },
    },
  });

  let sent = 0;
  for (const sub of expiring) {
    // Check if we already sent a reminder for this user recently
    const recentReminder = await prisma.emailLog.findFirst({
      where: {
        userId: sub.userId,
        type: "SUBSCRIPTION_EXPIRING",
        createdAt: { gte: today },
      },
    });

    if (!recentReminder && sub.expiresAt) {
      await sendExpiringReminder({
        userId: sub.userId,
        planName: sub.plan.name,
        expiresAt: sub.expiresAt,
      });
      sent++;
    }
  }

  return { checked: expiring.length, sent };
}
