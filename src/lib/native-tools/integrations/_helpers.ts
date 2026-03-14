// ─── Integration Helpers ────────────────────────────────
// Shared utilities for integration-specific native tools.

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import { getSettingNumber } from "@/lib/settings";
import type { Integration } from "@prisma/client";

/**
 * Look up a user's connected Integration by name or return the first connected one.
 * Only returns integrations with status=CONNECTED.
 */
export async function getIntegrationForUser(
  userId: string,
  integrationName?: string
): Promise<Integration | null> {
  if (integrationName) {
    return prisma.integration.findFirst({
      where: {
        userId,
        name: { equals: integrationName, mode: "insensitive" },
        status: "CONNECTED",
      },
    });
  }

  // No name specified — return the first connected integration
  return prisma.integration.findFirst({
    where: { userId, status: "CONNECTED" },
    orderBy: { updatedAt: "desc" },
  });
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
