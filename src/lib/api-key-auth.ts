import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { fireAndForget } from "@/lib/logger";
import { createHash } from "crypto";

interface ApiKeyAuthResult {
  userId: string;
  keyId: string;
}

/**
 * Authenticate request by API key from Authorization header.
 * Returns userId if valid, or NextResponse error.
 */
export async function authenticateApiKey(
  req: Request
): Promise<{ auth: ApiKeyAuthResult } | { error: NextResponse }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Missing API key" }, { status: 401 }) };
  }

  const key = authHeader.slice(7);
  const keyHash = createHash("sha256").update(key).digest("hex");

  // Try hash-based lookup first (new keys), fall back to plaintext (legacy keys)
  let apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, isBanned: true } } },
  });
  if (!apiKey) {
    apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: { user: { select: { id: true, isBanned: true } } },
    });
  }

  if (!apiKey || !apiKey.isActive) {
    return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { error: NextResponse.json({ error: "API key expired" }, { status: 401 }) };
  }

  if (apiKey.user.isBanned) {
    return { error: NextResponse.json({ error: "Account banned" }, { status: 403 }) };
  }

  // Per-key rate limiting
  const allowed = await checkRateLimit(`apikey:${apiKey.id}`, apiKey.rateLimit, 60_000);
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      ),
    };
  }

  // Update last used (fire-and-forget)
  fireAndForget(
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } }),
    "api-key-auth:updateLastUsed"
  );

  return { auth: { userId: apiKey.user.id, keyId: apiKey.id } };
}
