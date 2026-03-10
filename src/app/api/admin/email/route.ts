import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendEmail, verifySmtp } from "@/lib/email";
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

  return jsonError("Неизвестное действие", 400);
}
