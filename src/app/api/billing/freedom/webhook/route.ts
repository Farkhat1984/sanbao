import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature, buildCallbackResponse } from "@/lib/freedom-pay";
import { logger, fireAndForget } from "@/lib/logger";
import { invalidatePlanCache } from "@/lib/usage";
import { sendInvoiceEmail, sendPaymentFailedNotification } from "@/lib/invoice";

/**
 * Freedom Pay result_url callback.
 * Called server-to-server when payment completes.
 * Must respond with XML.
 */
export async function POST(req: Request) {
  let params: Record<string, string>;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      params = Object.fromEntries(
        Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
      );
    } else {
      // Try to parse as URL-encoded body
      const text = await req.text();
      params = Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return xmlResponse(buildCallbackResponse("rejected", "Invalid request format"), 400);
  }

  // Extract callback path for signature verification
  const url = new URL(req.url);
  const scriptPath = url.pathname.split("/").pop() || "webhook";

  // Verify signature
  if (!verifySignature(scriptPath, params)) {
    logger.warn("Freedom Pay webhook: invalid signature", { params });
    return xmlResponse(buildCallbackResponse("rejected", "Invalid signature"), 403);
  }

  const orderId = params.pg_order_id;
  const pgResult = params.pg_result; // "1" = success, "0" = failure
  const paymentId = params.pg_payment_id;
  const testingMode = params.pg_testing_mode === "1";

  if (!orderId) {
    return xmlResponse(buildCallbackResponse("rejected", "Missing order ID"), 400);
  }

  // Find payment record
  const payment = await prisma.payment.findUnique({ where: { id: orderId } });
  if (!payment) {
    logger.error("Freedom Pay webhook: payment not found", { orderId, paymentId });
    return xmlResponse(buildCallbackResponse("rejected", "Payment not found"), 404);
  }

  // Already processed
  if (payment.status === "COMPLETED") {
    return xmlResponse(buildCallbackResponse("ok", "Already processed"));
  }

  if (pgResult === "1") {
    // Payment successful — activate subscription
    try {
      const metadata = payment.metadata as { planId?: string } | null;
      const planId = metadata?.planId;

      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: orderId },
          data: {
            status: "COMPLETED",
            externalId: paymentId || payment.externalId,
            metadata: {
              ...((payment.metadata as object) || {}),
              pgResult,
              testingMode,
              cardPan: params.pg_card_pan,
              completedAt: new Date().toISOString(),
            },
          },
        });

        // Activate/extend subscription
        if (planId) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await tx.subscription.upsert({
            where: { userId: payment.userId },
            create: {
              userId: payment.userId,
              planId,
              expiresAt,
            },
            update: {
              planId,
              expiresAt,
            },
          });
        }
      });

      // Invalidate plan cache so the user sees their new plan immediately
      await invalidatePlanCache(payment.userId);

      // Send invoice email (fire-and-forget)
      if (planId) {
        const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { name: true } });
        if (plan) {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          fireAndForget(
            sendInvoiceEmail({
              userId: payment.userId,
              planName: plan.name,
              amount: `${payment.amount.toLocaleString("ru-RU")} ${payment.currency}`,
              periodStart: now,
              periodEnd,
            }),
            "freedom:sendInvoiceEmail"
          );
        }
      }

      logger.info("Freedom Pay: payment completed", { orderId, paymentId, planId });
      return xmlResponse(buildCallbackResponse("ok", "Payment accepted"));
    } catch (err) {
      logger.error("Freedom Pay webhook: processing error", { error: err, orderId });
      return xmlResponse(buildCallbackResponse("rejected", "Processing error"), 500);
    }
  } else {
    // Payment failed
    await prisma.payment.update({
      where: { id: orderId },
      data: {
        status: "FAILED",
        metadata: {
          ...((payment.metadata as object) || {}),
          pgResult,
          failedAt: new Date().toISOString(),
        },
      },
    });

    // Send failure notification (fire-and-forget)
    const failMeta = payment.metadata as { planId?: string } | null;
    if (failMeta?.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: failMeta.planId }, select: { name: true } });
      if (plan) {
        fireAndForget(
          sendPaymentFailedNotification({ userId: payment.userId, planName: plan.name }),
          "freedom:sendPaymentFailedNotification"
        );
      }
    }

    logger.info("Freedom Pay: payment failed", { orderId, paymentId });
    return xmlResponse(buildCallbackResponse("ok", "Failure acknowledged"));
  }
}

function xmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
