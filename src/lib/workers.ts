/**
 * Background job worker registrations.
 * Import this file once at app startup to register all processors.
 */

import { registerWorker, enqueue } from "@/lib/queue";

// ─── Webhook dispatch worker ─────────────────────────────

registerWorker("webhook", async (data) => {
  // Dynamic import to avoid circular deps
  const { dispatchWebhook } = await import("@/lib/webhook-dispatcher");
  await dispatchWebhook(
    data.event as string,
    data.payload as Record<string, unknown>
  );
});

/** Enqueue a webhook dispatch job. */
export async function enqueueWebhook(event: string, payload: Record<string, unknown>) {
  await enqueue("webhook", { event, payload });
}

// ─── Email send worker ───────────────────────────────────

registerWorker("email", async (data) => {
  const { sendEmail } = await import("@/lib/email");
  await sendEmail(data as unknown as Parameters<typeof sendEmail>[0]);
});

/** Enqueue an email send job. */
export async function enqueueEmail(emailData: Record<string, unknown>) {
  await enqueue("email", emailData);
}
