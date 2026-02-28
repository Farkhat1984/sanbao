/**
 * Freedom Pay Kazakhstan — payment gateway client.
 *
 * API: https://freedompay.kz/docs-en/merchant-api/intro
 * Auth: MD5 signature (pg_sig) — sort params, prepend script name, append secret, join with ";", MD5.
 * Flow: init_payment → redirect → user pays → result_url callback → confirm.
 */

import crypto from "crypto";
import { logger } from "./logger";

// ─── Configuration ──────────────────────────────────────

const FREEDOM_MERCHANT_ID = process.env.FREEDOM_PAY_MERCHANT_ID || "";
const FREEDOM_SECRET_KEY = process.env.FREEDOM_PAY_SECRET_KEY || "";
const FREEDOM_API_URL = process.env.FREEDOM_PAY_API_URL || "https://api.freedompay.kz";
const FREEDOM_RESULT_URL = process.env.FREEDOM_PAY_RESULT_URL || "";
const FREEDOM_SUCCESS_URL = process.env.FREEDOM_PAY_SUCCESS_URL || "";
const FREEDOM_FAILURE_URL = process.env.FREEDOM_PAY_FAILURE_URL || "";
const FREEDOM_TESTING_MODE = process.env.FREEDOM_PAY_TESTING_MODE === "1" ? "1" : undefined;

// ─── Signature ──────────────────────────────────────────

/**
 * Generate MD5 signature per Freedom Pay spec.
 * Algorithm: sort params alphabetically → prepend script name → append secret → join with ";" → MD5.
 */
export function generateSignature(
  scriptName: string,
  params: Record<string, string>,
  secretKey: string = FREEDOM_SECRET_KEY
): string {
  const sorted = Object.keys(params).sort();
  const parts = [scriptName];
  for (const key of sorted) {
    parts.push(params[key]);
  }
  parts.push(secretKey);
  return crypto.createHash("md5").update(parts.join(";")).digest("hex");
}

/**
 * Verify signature on incoming callback.
 */
export function verifySignature(
  scriptName: string,
  params: Record<string, string>,
  secretKey: string = FREEDOM_SECRET_KEY
): boolean {
  const { pg_sig, ...rest } = params;
  if (!pg_sig) return false;
  const expected = generateSignature(scriptName, rest, secretKey);
  const sigBuf = Buffer.from(pg_sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ─── Init Payment ───────────────────────────────────────

export interface InitPaymentParams {
  orderId: string;
  amount: number; // in KZT (e.g. 5990 for 5990 KZT)
  description: string;
  userEmail?: string;
  userPhone?: string;
  userId?: string;
  currency?: string;
}

export interface InitPaymentResult {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Create a payment and get redirect URL.
 */
export async function initPayment(params: InitPaymentParams): Promise<InitPaymentResult> {
  const salt = crypto.randomBytes(16).toString("hex");

  const reqParams: Record<string, string> = {
    pg_merchant_id: FREEDOM_MERCHANT_ID,
    pg_amount: String(params.amount),
    pg_currency: params.currency || "KZT",
    pg_description: params.description,
    pg_order_id: params.orderId,
    pg_salt: salt,
    pg_result_url: FREEDOM_RESULT_URL,
    pg_success_url: FREEDOM_SUCCESS_URL,
    pg_failure_url: FREEDOM_FAILURE_URL,
    pg_request_method: "POST",
  };

  if (params.userEmail) reqParams.pg_user_contact_email = params.userEmail;
  if (params.userPhone) reqParams.pg_user_phone = params.userPhone;
  if (params.userId) reqParams.pg_user_id = params.userId;
  if (FREEDOM_TESTING_MODE) reqParams.pg_testing_mode = "1";

  reqParams.pg_sig = generateSignature("init_payment.php", reqParams);

  try {
    const response = await fetch(`${FREEDOM_API_URL}/init_payment.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(reqParams).toString(),
    });

    const xml = await response.text();
    const status = extractXmlTag(xml, "pg_status");
    const paymentId = extractXmlTag(xml, "pg_payment_id");
    const redirectUrl = extractXmlTag(xml, "pg_redirect_url");
    const errorDesc = extractXmlTag(xml, "pg_error_description");

    if (status === "ok" && redirectUrl) {
      return { success: true, paymentId: paymentId || undefined, redirectUrl };
    }

    logger.error("Freedom Pay init_payment failed", { status, errorDesc, orderId: params.orderId });
    return { success: false, error: errorDesc || "Ошибка инициализации платежа" };
  } catch (err) {
    logger.error("Freedom Pay init_payment error", { error: err, orderId: params.orderId });
    return { success: false, error: "Ошибка связи с платёжной системой" };
  }
}

// ─── Get Payment Status ─────────────────────────────────

export interface PaymentStatusResult {
  success: boolean;
  status?: string;
  amount?: string;
  paymentId?: string;
  cardPan?: string;
  error?: string;
}

/**
 * Check payment status.
 */
export async function getPaymentStatus(
  paymentId: string,
  orderId?: string
): Promise<PaymentStatusResult> {
  const salt = crypto.randomBytes(16).toString("hex");

  const reqParams: Record<string, string> = {
    pg_merchant_id: FREEDOM_MERCHANT_ID,
    pg_payment_id: paymentId,
    pg_salt: salt,
  };
  if (orderId) reqParams.pg_order_id = orderId;

  reqParams.pg_sig = generateSignature("get_status3.php", reqParams);

  try {
    const response = await fetch(`${FREEDOM_API_URL}/get_status3.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(reqParams).toString(),
    });

    const xml = await response.text();
    const status = extractXmlTag(xml, "pg_payment_status");
    const amount = extractXmlTag(xml, "pg_amount");
    const cardPan = extractXmlTag(xml, "pg_card_pan");

    return {
      success: true,
      status: status || undefined,
      amount: amount || undefined,
      paymentId,
      cardPan: cardPan || undefined,
    };
  } catch (err) {
    logger.error("Freedom Pay get_status error", { error: err, paymentId });
    return { success: false, error: "Ошибка проверки статуса платежа" };
  }
}

// ─── Refund ─────────────────────────────────────────────

export interface RefundResult {
  success: boolean;
  status?: string;
  error?: string;
}

/**
 * Refund a payment (full or partial).
 * Pass refundAmount = 0 or omit for full refund.
 */
export async function refundPayment(
  paymentId: string,
  refundAmount?: number
): Promise<RefundResult> {
  const salt = crypto.randomBytes(16).toString("hex");

  const reqParams: Record<string, string> = {
    pg_merchant_id: FREEDOM_MERCHANT_ID,
    pg_payment_id: paymentId,
    pg_salt: salt,
  };
  if (refundAmount && refundAmount > 0) {
    reqParams.pg_refund_amount = String(refundAmount);
  }

  reqParams.pg_sig = generateSignature("revoke.php", reqParams);

  try {
    const response = await fetch(`${FREEDOM_API_URL}/revoke.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(reqParams).toString(),
    });

    const xml = await response.text();
    const status = extractXmlTag(xml, "pg_status");

    if (status === "ok") {
      return { success: true, status: "refunded" };
    }

    const errorDesc = extractXmlTag(xml, "pg_error_description");
    return { success: false, error: errorDesc || "Ошибка возврата" };
  } catch (err) {
    logger.error("Freedom Pay refund error", { error: err, paymentId });
    return { success: false, error: "Ошибка связи с платёжной системой" };
  }
}

// ─── Callback Response Builder ──────────────────────────

/**
 * Build XML response for Freedom Pay result_url callback.
 */
export function buildCallbackResponse(
  status: "ok" | "rejected",
  description: string
): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const params: Record<string, string> = {
    pg_status: status,
    pg_description: description,
    pg_salt: salt,
  };
  params.pg_sig = generateSignature("result_url", params);

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<response>",
    `  <pg_status>${status}</pg_status>`,
    `  <pg_description>${escapeXml(description)}</pg_description>`,
    `  <pg_salt>${salt}</pg_salt>`,
    `  <pg_sig>${params.pg_sig}</pg_sig>`,
    "</response>",
  ].join("\n");
}

// ─── Helpers ────────────────────────────────────────────

/**
 * Extract a tag value from XML string.
 */
function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

/**
 * Escape special chars for XML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Check if Freedom Pay is configured.
 */
export function isFreedomPayConfigured(): boolean {
  return !!(FREEDOM_MERCHANT_ID && FREEDOM_SECRET_KEY);
}
