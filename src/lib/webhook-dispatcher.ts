import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";
import { WEBHOOK_MAX_ATTEMPTS, WEBHOOK_TIMEOUT_MS } from "@/lib/constants";

export async function dispatchWebhook(event: string, payload: Record<string, unknown>) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      isActive: true,
      events: { has: event },
    },
  });

  for (const webhook of webhooks) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");

    let attempt = 1;
    const maxAttempts = WEBHOOK_MAX_ATTEMPTS;
    let success = false;
    let statusCode: number | null = null;
    let response: string | null = null;
    let error: string | null = null;

    while (attempt <= maxAttempts && !success) {
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Event": event,
          },
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });

        statusCode = res.status;
        response = await res.text().catch(() => "");
        success = res.ok;

        if (!success && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Unknown error";
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      attempt++;
    }

    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as Prisma.InputJsonValue,
        statusCode,
        response: response?.slice(0, 1000) || null,
        success,
        attempt: attempt - 1,
        error,
      },
    });
  }
}
