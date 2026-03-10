import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendEmail, verifySmtp, invoiceEmail, subscriptionExpiringEmail } from "@/lib/email";
import { jsonOk, jsonError } from "@/lib/api-helpers";

/** GET — list email logs with pagination */
export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailLog.count({ where }),
  ]);

  return jsonOk({ logs, total, page, limit });
}

/** POST — actions: verify SMTP or send test email */
export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { action, to } = await req.json();

  if (action === "verify") {
    const check = await verifySmtp();
    return jsonOk(check);
  }

  if (action === "test" && to) {
    const ok = await sendEmail({
      to,
      subject: "Тестовое письмо — Sanbao",
      html: "<h2>Тест пройден!</h2><p>SMTP настроен и работает корректно.</p>",
      type: "WELCOME",
      metadata: { test: true },
    });
    return jsonOk({ ok });
  }

  // Broadcast: invoice email to all users
  if (action === "broadcast_invoice") {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
    const planName = "Business";
    const amount = "14 990 ₸";
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const period = `${fmt(now)} — ${fmt(end)}`;
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${rand}`;

    let sent = 0;
    for (const user of users) {
      const { subject, html } = await invoiceEmail({
        userName: user.name || "Пользователь",
        planName,
        amount,
        period,
        invoiceNumber,
      });
      const ok = await sendEmail({ to: user.email, subject, html, type: "INVOICE", userId: user.id, metadata: { broadcast: true, invoiceNumber } });
      if (ok) sent++;
    }
    return jsonOk({ total: users.length, sent });
  }

  // Broadcast: subscription expiring in 3 days
  if (action === "broadcast_expiring") {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
    const planName = "Business";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);
    const fmtDate = expiresAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

    let sent = 0;
    for (const user of users) {
      const { subject, html } = await subscriptionExpiringEmail({
        userName: user.name || "Пользователь",
        planName,
        expiresAt: fmtDate,
      });
      const ok = await sendEmail({ to: user.email, subject, html, type: "SUBSCRIPTION_EXPIRING", userId: user.id, metadata: { broadcast: true } });
      if (ok) sent++;
    }
    return jsonOk({ total: users.length, sent });
  }

  return jsonError("Неизвестное действие", 400);
}
