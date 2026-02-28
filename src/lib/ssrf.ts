/**
 * Shared SSRF protection — validates URLs against private/internal networks.
 * Use this for any user-supplied URL before making server-side requests.
 *
 * isUrlSafe()      — sync, string-based hostname check (fast path)
 * isUrlSafeAsync() — async, resolves DNS and checks resolved IPs (DNS rebinding safe)
 */

import dns from "dns";

const BLOCKED_HOSTS =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1?\]|metadata\.google|169\.254\.\d+\.\d+)/i;

/** IPv6 private/reserved ranges: loopback, IPv4-mapped loopback, unique local (fc00::/7), link-local (fe80::/10) */
const BLOCKED_IPV6 =
  /^(::1|::ffff:127\.\d+\.\d+\.\d+|\[::1\]|\[::ffff:127\.\d+\.\d+\.\d+\]|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

/** Blocked IPv4 ranges for resolved IP addresses */
const BLOCKED_IPV4_RESOLVED =
  /^(127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/;

/** Blocked IPv6 ranges for resolved IP addresses */
const BLOCKED_IPV6_RESOLVED =
  /^(::1|::ffff:127\.\d+\.\d+\.\d+|::ffff:0:127\.\d+\.\d+\.\d+|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

/** Sync string-based SSRF check. Use isUrlSafeAsync() when possible for DNS rebinding protection. */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (BLOCKED_HOSTS.test(parsed.hostname)) return false;
    // Strip brackets from IPv6 hostnames for regex matching
    const bare = parsed.hostname.replace(/^\[|\]$/g, "");
    if (BLOCKED_IPV6.test(bare)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Async SSRF check with DNS resolution — prevents DNS rebinding attacks.
 * First does string-based checks (fast path reject), then resolves DNS
 * and verifies each resolved IP is not in a private/reserved range.
 */
export async function isUrlSafeAsync(url: string): Promise<boolean> {
  // Fast path: reject on string-based checks
  if (!isUrlSafe(url)) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

    // If hostname is already an IP literal, the sync check was sufficient
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (hostname.includes(":")) return true; // IPv6 literal, already checked

    // Resolve A records (IPv4)
    let ipv4Addrs: string[] = [];
    try {
      ipv4Addrs = await dns.promises.resolve4(hostname);
    } catch {
      // NXDOMAIN or no A records — not necessarily an error, try AAAA
    }

    // Resolve AAAA records (IPv6)
    let ipv6Addrs: string[] = [];
    try {
      ipv6Addrs = await dns.promises.resolve6(hostname);
    } catch {
      // No AAAA records
    }

    // If DNS returned nothing at all, block (hostname doesn't resolve)
    if (ipv4Addrs.length === 0 && ipv6Addrs.length === 0) {
      return false;
    }

    // Check all resolved IPv4 addresses
    for (const ip of ipv4Addrs) {
      if (BLOCKED_IPV4_RESOLVED.test(ip)) return false;
    }

    // Check all resolved IPv6 addresses
    for (const ip of ipv6Addrs) {
      if (BLOCKED_IPV6_RESOLVED.test(ip)) return false;
    }

    return true;
  } catch {
    return false;
  }
}
