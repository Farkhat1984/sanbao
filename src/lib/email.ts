import nodemailer from "nodemailer";
import type { EmailType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── SMTP Transport ─────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/** Reset transporter (after config changes from admin). */
export function resetTransporter() {
  transporter = null;
}

// ─── Email sending ──────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: EmailType;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, text, type, userId, metadata } = options;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@leema.ai";

  // Log the attempt
  const log = await prisma.emailLog.create({
    data: {
      to,
      subject,
      type,
      userId: userId || null,
      status: "PENDING",
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });

  const transport = getTransporter();
  if (!transport) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: "SMTP not configured" },
    });
    console.error("Email not sent: SMTP not configured");
    return false;
  }

  try {
    await transport.sendMail({ from, to, subject, html, text: text || "" });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT" },
    });

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: errorMsg },
    });
    console.error("Email send failed:", errorMsg);
    return false;
  }
}

/** Verify SMTP connection works. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    return { ok: false, error: "SMTP не настроен. Проверьте переменные SMTP_HOST, SMTP_USER, SMTP_PASS." };
  }

  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}

// ─── Email templates ────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:linear-gradient(135deg,#4F6EF7,#7C3AED);padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Leema</h1>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eef1f6;color:#8892a4;font-size:12px;text-align:center;">
&copy; ${new Date().getFullYear()} Leema. Все права защищены.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function welcomeEmail(userName: string): { subject: string; html: string } {
  return {
    subject: "Добро пожаловать в Leema!",
    html: baseLayout(`
      <h2 style="margin:0 0 16px;color:#1a1f36;">Здравствуйте${userName ? `, ${userName}` : ""}!</h2>
      <p style="color:#4a5568;line-height:1.6;">Ваш аккаунт успешно создан. Теперь вам доступен AI-ассистент для работы с документами и анализа.</p>
      <p style="color:#4a5568;line-height:1.6;">Начните с создания первого чата или изучите возможности платформы.</p>
    `),
  };
}

export function invoiceEmail(data: {
  userName: string;
  planName: string;
  amount: string;
  period: string;
  invoiceNumber: string;
}): { subject: string; html: string } {
  return {
    subject: `Счёт #${data.invoiceNumber} — Leema`,
    html: baseLayout(`
      <h2 style="margin:0 0 16px;color:#1a1f36;">Счёт за подписку</h2>
      <p style="color:#4a5568;line-height:1.6;">Здравствуйте, ${data.userName}!</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="margin:16px 0;border:1px solid #eef1f6;border-radius:8px;">
        <tr style="background:#f8f9fc;">
          <td style="color:#8892a4;font-size:13px;">Номер счёта</td>
          <td style="color:#1a1f36;font-weight:600;text-align:right;">#${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#8892a4;font-size:13px;">Тариф</td>
          <td style="color:#1a1f36;text-align:right;">${data.planName}</td>
        </tr>
        <tr style="background:#f8f9fc;">
          <td style="color:#8892a4;font-size:13px;">Период</td>
          <td style="color:#1a1f36;text-align:right;">${data.period}</td>
        </tr>
        <tr>
          <td style="color:#8892a4;font-size:13px;">Сумма</td>
          <td style="color:#4F6EF7;font-weight:700;text-align:right;font-size:16px;">${data.amount}</td>
        </tr>
      </table>
      <p style="color:#4a5568;line-height:1.6;font-size:13px;">Спасибо за использование Leema!</p>
    `),
  };
}

export function subscriptionExpiringEmail(data: {
  userName: string;
  planName: string;
  expiresAt: string;
}): { subject: string; html: string } {
  return {
    subject: "Ваша подписка скоро истекает — Leema",
    html: baseLayout(`
      <h2 style="margin:0 0 16px;color:#1a1f36;">Подписка истекает</h2>
      <p style="color:#4a5568;line-height:1.6;">Здравствуйте, ${data.userName}!</p>
      <p style="color:#4a5568;line-height:1.6;">Ваша подписка на тариф <strong>${data.planName}</strong> истекает <strong>${data.expiresAt}</strong>.</p>
      <p style="color:#4a5568;line-height:1.6;">Продлите подписку, чтобы не потерять доступ к функциям.</p>
    `),
  };
}

export function paymentFailedEmail(data: {
  userName: string;
  planName: string;
}): { subject: string; html: string } {
  return {
    subject: "Ошибка оплаты — Leema",
    html: baseLayout(`
      <h2 style="margin:0 0 16px;color:#1a1f36;">Ошибка оплаты</h2>
      <p style="color:#4a5568;line-height:1.6;">Здравствуйте, ${data.userName}!</p>
      <p style="color:#4a5568;line-height:1.6;">Не удалось списать оплату за тариф <strong>${data.planName}</strong>. Пожалуйста, проверьте платёжные данные.</p>
    `),
  };
}
