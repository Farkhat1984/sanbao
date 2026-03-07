/**
 * E2E Test Helpers
 *
 * Shared utilities for end-to-end tests that run against a live Sanbao instance.
 * These tests use real HTTP requests (no mocks).
 *
 * Requirements:
 *   - A running Sanbao instance (default: http://localhost:3004)
 *   - Valid AUTH_SECRET for JWT signing
 *
 * Environment variables:
 *   BASE_URL      — Sanbao base URL (default: http://localhost:3004)
 *   AUTH_SECRET    — NextAuth secret for token signing
 *   ADMIN_USER_ID — Admin user ID in the database
 */

import { encode } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.BASE_URL || "http://localhost:3004";
export const AUTH_SECRET =
  process.env.AUTH_SECRET || "DDYVaKEax0AYQ1IOmmi2KpJw3ItCouKkZFfKjW2DUp4=";
export const ADMIN_USER_ID =
  process.env.ADMIN_USER_ID || "cmln2gum30000li01hzt4kcgy";
export const COOKIE_NAME = "__Secure-authjs.session-token";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Create a signed NextAuth session token for the admin user.
 * Returns the raw JWT string (not the cookie header).
 */
export async function createAdminToken(): Promise<string> {
  return encode({
    token: {
      id: ADMIN_USER_ID,
      name: "E2E Test Admin",
      email: "zfaragj@gmail.com",
      role: "ADMIN",
      twoFactorVerified: false,
      iat: Math.floor(Date.now() / 1000),
      sub: ADMIN_USER_ID,
    },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
    maxAge: 3600,
  });
}

/**
 * Create a signed NextAuth session token for a regular (non-admin) user.
 */
export async function createUserToken(
  userId = "test-user-e2e",
  email = "e2e-user@test.local",
): Promise<string> {
  return encode({
    token: {
      id: userId,
      name: "E2E Test User",
      email,
      role: "USER",
      twoFactorVerified: false,
      iat: Math.floor(Date.now() / 1000),
      sub: userId,
    },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
    maxAge: 3600,
  });
}

/**
 * Build Cookie header value from a JWT token.
 */
export function cookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  /** Request timeout in ms (default 30000) */
  timeout?: number;
}

/**
 * Make an authenticated HTTP request to the Sanbao API.
 */
export async function apiRequest(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { method = "GET", body, token, headers = {}, timeout = 30_000 } = options;

  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const reqHeaders: Record<string, string> = { ...headers };
  if (token) {
    reqHeaders["Cookie"] = cookieHeader(token);
  }
  if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// NDJSON stream helpers
// ---------------------------------------------------------------------------

export interface StreamChunk {
  /** Tag: c=content, r=reasoning, s=status, x=context, e=error, p=progress */
  t: string;
  v: string;
}

/**
 * Parse an NDJSON streaming response into an array of typed chunks.
 */
export async function parseStream(response: Response): Promise<StreamChunk[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const chunks: StreamChunk[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        chunks.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
  }

  return chunks;
}

/**
 * Extract concatenated content text from stream chunks.
 */
export function getStreamContent(chunks: StreamChunk[]): string {
  return chunks
    .filter((c) => c.t === "c")
    .map((c) => c.v)
    .join("");
}

/**
 * Extract status values from stream chunks.
 */
export function getStreamStatuses(chunks: StreamChunk[]): string[] {
  return chunks.filter((c) => c.t === "s").map((c) => c.v);
}

/**
 * Extract error messages from stream chunks.
 */
export function getStreamErrors(chunks: StreamChunk[]): string[] {
  return chunks.filter((c) => c.t === "e").map((c) => c.v);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a response has a specific HTTP status code.
 * Returns the parsed JSON body if status matches.
 */
export async function expectStatus(
  res: Response,
  expectedStatus: number,
): Promise<unknown> {
  if (res.status !== expectedStatus) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `Expected HTTP ${expectedStatus}, got ${res.status}. Body: ${text.slice(0, 500)}`,
    );
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

/**
 * Check if the Sanbao instance is reachable.
 * Useful as a precondition check before running E2E tests.
 */
export async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
