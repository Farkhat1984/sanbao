import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { CACHE_TTL } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettingNumber } from "@/lib/settings";
import net from "net";

/** Normalize IP address for consistent comparison (handles IPv6 variants, IPv4-mapped IPv6). */
function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  // Handle IPv4-mapped IPv6 (e.g., ::ffff:192.168.1.1 → 192.168.1.1)
  if (trimmed.startsWith("::ffff:") && net.isIPv4(trimmed.slice(7))) {
    return trimmed.slice(7);
  }
  // Normalize IPv6 to full expanded lowercase form
  if (net.isIPv6(trimmed)) {
    // Use Buffer round-trip to normalize IPv6 representation
    const parts = trimmed.split(":");
    // Expand :: shorthand
    const dblIdx = parts.indexOf("");
    if (dblIdx !== -1) {
      const fill = 8 - parts.filter(Boolean).length;
      parts.splice(dblIdx, parts.filter((p) => p === "").length, ...Array(fill).fill("0"));
    }
    return parts.map((p) => (p || "0").padStart(4, "0").toLowerCase()).join(":");
  }
  return trimmed;
}

// ─── IP whitelist cache ───
let ipWhitelistCache: { ips: string[]; expiresAt: number } | null = null;
const IP_CACHE_TTL = CACHE_TTL;

async function getIpWhitelist(): Promise<string[]> {
  if (ipWhitelistCache && ipWhitelistCache.expiresAt > Date.now()) {
    return ipWhitelistCache.ips;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "admin_ip_whitelist" },
    });
    const ips = setting?.value
      ? setting.value.split(",").map((ip) => ip.trim()).filter(Boolean)
      : [];
    ipWhitelistCache = { ips, expiresAt: Date.now() + IP_CACHE_TTL };
    return ips;
  } catch {
    return [];
  }
}

/** Reset IP whitelist cache (call after admin settings save). */
export function resetIpWhitelistCache() {
  ipWhitelistCache = null;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, twoFactorEnabled: true },
  });
  if (user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  // Enforce 2FA: if admin has 2FA enabled, session must have passed verification
  if (user.twoFactorEnabled && !session.user.twoFactorVerified) {
    return { error: NextResponse.json({ error: "2FA verification required" }, { status: 403 }) };
  }

  // Admin rate limit
  const rateAdmin = await getSettingNumber('rate_admin_per_minute');
  const allowed = await checkRateLimit(`admin:${session.user.id}`, rateAdmin, 60_000);
  if (!allowed) {
    return { error: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }) };
  }

  // IP whitelist check (with IPv6 normalization)
  const whitelist = await getIpWhitelist();
  if (whitelist.length > 0) {
    const hdrs = await headers();
    const rawIp =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      "127.0.0.1";
    const clientIp = normalizeIp(rawIp);
    const isLoopback = clientIp === "127.0.0.1" || clientIp === "0000:0000:0000:0000:0000:0000:0000:0001";
    if (!isLoopback && !whitelist.map(normalizeIp).some((wip) => wip === clientIp)) {
      return { error: NextResponse.json({ error: "IP not allowed" }, { status: 403 }) };
    }
  }

  return { userId: session.user.id };
}
