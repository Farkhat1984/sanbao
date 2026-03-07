import { registerNativeTool } from "./registry";
import {
  NATIVE_TOOL_HTTP_TIMEOUT_MS,
  NATIVE_TOOL_HTTP_MAX_TIMEOUT_MS,
  NATIVE_TOOL_HTTP_MAX_RESPONSE_BYTES,
} from "../constants";
import dns from "node:dns/promises";

// ─── SSRF Protection ───────────────────────────────────

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
];

function isBlockedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Некорректный URL";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return `Протокол ${parsed.protocol} запрещён. Допустимы только http и https.`;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    return `Хост ${hostname} заблокирован (локальный адрес)`;
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return `Хост ${hostname} заблокирован (приватная сеть)`;
    }
  }

  return null;
}

/**
 * DNS rebinding protection: resolve hostname and verify the IP is not private/internal.
 * Prevents attacks where a public domain resolves to an internal IP after initial URL check.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (ip === "0.0.0.0") return true;
  if (/^169\.254\./.test(ip)) return true; // link-local

  // IPv6 private/local
  if (ip === "::1" || ip === "[::1]") return true;
  if (/^fe80:/i.test(ip)) return true;   // link-local
  if (/^fc00:/i.test(ip)) return true;   // unique local
  if (/^fd/i.test(ip)) return true;      // unique local

  // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.x.x.x, etc.)
  const mappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatch) {
    return isPrivateIp(mappedMatch[1]);
  }

  return false;
}

async function checkDnsRebinding(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Некорректный URL";
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Skip DNS lookup for raw IP addresses — already checked by isBlockedUrl
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    return null;
  }

  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) {
      return `DNS для ${parsed.hostname} разрешился в приватный IP ${address}`;
    }
  } catch {
    return `Не удалось разрешить DNS для ${parsed.hostname}`;
  }

  return null;
}

// ─── Response truncation ───────────────────────────────

function truncateResponse(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf-8") <= maxBytes) return text;

  // Binary search for the right cut point
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

  return text.slice(0, lo) + "\n...[ответ обрезан, превышен лимит 50KB]";
}

// ─── http_request tool ─────────────────────────────────

registerNativeTool({
  name: "http_request",
  description:
    "Отправляет HTTP-запрос к внешнему API. Используй для интеграции с 1С, CRM, REST API и другими сервисами. Поддерживает GET, POST, PUT, PATCH, DELETE. Автоматически парсит JSON-ответы.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Полный URL запроса (https://...)",
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "HTTP метод. По умолчанию GET.",
      },
      headers: {
        type: "object",
        description: "HTTP заголовки (например, Authorization, Content-Type)",
        additionalProperties: { type: "string" },
      },
      body: {
        type: "string",
        description: "Тело запроса (для POST/PUT/PATCH). Строка или JSON.",
      },
      timeout: {
        type: "number",
        description: `Таймаут в миллисекундах (макс. ${NATIVE_TOOL_HTTP_MAX_TIMEOUT_MS}). По умолчанию ${NATIVE_TOOL_HTTP_TIMEOUT_MS}.`,
      },
    },
    required: ["url"],
  },
  async execute(args) {
    const url = args.url as string;
    const method = ((args.method as string) || "GET").toUpperCase();
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string | undefined;
    const timeout = Math.min(
      Number(args.timeout) || NATIVE_TOOL_HTTP_TIMEOUT_MS,
      NATIVE_TOOL_HTTP_MAX_TIMEOUT_MS
    );

    // SSRF check
    const blocked = isBlockedUrl(url);
    if (blocked) {
      return JSON.stringify({ error: blocked });
    }

    // DNS rebinding protection: verify resolved IP is not private/internal
    const dnsBlocked = await checkDnsRebinding(url);
    if (dnsBlocked) {
      return JSON.stringify({ error: dnsBlocked });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
        signal: controller.signal,
        redirect: "manual",
      });

      // Handle redirects manually to prevent SSRF via redirect to internal IPs
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (location) {
          const redirectBlocked = isBlockedUrl(location);
          if (redirectBlocked) {
            return JSON.stringify({
              error: `Редирект заблокирован: ${redirectBlocked}`,
              redirectUrl: location,
            });
          }
          return JSON.stringify({
            status: res.status,
            redirect: location,
            message: "Получен редирект. Повтори запрос с новым URL.",
          });
        }
      }

      const contentType = res.headers.get("content-type") || "";
      let responseBody: string;

      if (contentType.includes("application/json")) {
        const text = await res.text();
        responseBody = truncateResponse(text, NATIVE_TOOL_HTTP_MAX_RESPONSE_BYTES);
      } else if (contentType.startsWith("text/")) {
        const text = await res.text();
        responseBody = truncateResponse(text, NATIVE_TOOL_HTTP_MAX_RESPONSE_BYTES);
      } else {
        // Binary / unknown — just report status
        responseBody = `[Бинарный ответ: ${contentType}, ${res.headers.get("content-length") || "?"} bytes]`;
      }

      return JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(
          [...res.headers.entries()].filter(([k]) =>
            ["content-type", "x-request-id", "x-total-count", "link"].includes(k.toLowerCase())
          )
        ),
        body: responseBody,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: `Таймаут запроса (${timeout}мс)` });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка запроса: ${msg}` });
    } finally {
      clearTimeout(timer);
    }
  },
});
