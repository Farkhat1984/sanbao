/**
 * Shared SSRF protection — validates URLs against private/internal networks.
 * Use this for any user-supplied URL before making server-side requests.
 */

const BLOCKED_HOSTS =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1?\]|metadata\.google|169\.254\.\d+\.\d+)/i;

export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (BLOCKED_HOSTS.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
