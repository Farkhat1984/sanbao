import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { CACHE_TTL } from "@/lib/constants";

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
    select: { role: true },
  });
  if (user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  // IP whitelist check
  const whitelist = await getIpWhitelist();
  if (whitelist.length > 0) {
    const hdrs = await headers();
    const clientIp =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      "127.0.0.1";
    if (clientIp !== "127.0.0.1" && clientIp !== "::1" && !whitelist.includes(clientIp)) {
      return { error: NextResponse.json({ error: "IP not allowed" }, { status: 403 }) };
    }
  }

  return { userId: session.user.id };
}
