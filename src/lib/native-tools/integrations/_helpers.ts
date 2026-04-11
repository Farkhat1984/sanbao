// ─── Integration Helpers ────────────────────────────────
// Shared utilities for integration-specific native tools.

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import { getSettingNumber } from "@/lib/settings";
import type { Integration, IntegrationType } from "@prisma/client";
import type { WhatsAppCredentials, TelegramCredentials } from "@/types/integration";

/**
 * Look up a user's connected Integration by name or return the first connected one.
 * Only returns integrations with status=CONNECTED.
 * Optional type filter prevents cross-type matches.
 */
export async function getIntegrationForUser(
  userId: string,
  integrationName?: string,
  type?: IntegrationType
): Promise<Integration | null> {
  if (integrationName) {
    return prisma.integration.findFirst({
      where: {
        userId,
        name: { equals: integrationName, mode: "insensitive" },
        status: "CONNECTED",
        ...(type ? { type } : {}),
      },
    });
  }

  return prisma.integration.findFirst({
    where: { userId, status: "CONNECTED", ...(type ? { type } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Look up a user's connected WhatsApp integration.
 */
export async function getWhatsAppIntegrationForUser(
  userId: string,
  integrationName?: string
): Promise<Integration | null> {
  return getIntegrationForUser(userId, integrationName, "WHATSAPP");
}

/**
 * Make an authenticated request to the rk-wa WhatsApp service.
 * Decrypts stored credentials and adds x-api-key header.
 */
export async function makeWhatsAppRequest(
  integration: Integration,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  timeoutMs?: number
): Promise<Response> {
  const creds = JSON.parse(decrypt(integration.credentials)) as WhatsAppCredentials;
  const url = `${integration.baseUrl}/api/whatsapp/${creds.instanceId}/${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 30_000);

  try {
    return await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": creds.apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up a user's connected Telegram integration.
 */
export async function getTelegramIntegrationForUser(
  userId: string,
  integrationName?: string
): Promise<Integration | null> {
  return getIntegrationForUser(userId, integrationName, "TELEGRAM");
}

/**
 * Make an authenticated request to the rk-tg Telegram service.
 * Decrypts stored credentials and adds x-api-key header.
 */
export async function makeTelegramRequest(
  integration: Integration,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  timeoutMs?: number
): Promise<Response> {
  const creds = JSON.parse(decrypt(integration.credentials)) as TelegramCredentials;
  const url = `${integration.baseUrl}/api/telegram/${creds.instanceId}/${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 30_000);

  try {
    return await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": creds.apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make an authenticated OData request to a 1C integration.
 * Decrypts stored credentials and adds Basic auth header.
 * Includes SSRF protection and configurable timeout.
 */
export async function makeAuthenticatedODataRequest(
  integration: Integration,
  path: string,
  timeoutMs?: number
): Promise<Response> {
  const url = `${integration.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  // SSRF protection
  const safe = await isUrlSafeAsync(url);
  if (!safe) {
    throw new Error(`URL заблокирован (SSRF): ${url}`);
  }

  const basicAuth = decrypt(integration.credentials);
  const defaultTimeout = await getSettingNumber("native_http_timeout_ms");
  const timeout = timeoutMs ?? defaultTimeout;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Truncate a response string to fit within maxBytes.
 * Uses binary search for efficient UTF-8 aware truncation.
 */
export function truncateResponse(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf-8") <= maxBytes) return text;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (Buffer.byteLength(text.slice(0, mid), "utf-8") <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, lo) + "\n...[ответ обрезан, превышен лимит]";
}
