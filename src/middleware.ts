import { NextRequest, NextResponse } from "next/server";

// ─── P3-40: CSRF Origin Validation ──────────────────────────────────────────
// Validates Origin header on state-changing requests (POST/PUT/PATCH/DELETE).
// Exempts webhook endpoints (Stripe/Freedom), health probes, and Bearer-authed
// API consumers.

const ALLOWED_ORIGINS = new Set([
  "https://sanbao.ai",
  "https://www.sanbao.ai",
  // Local development
  "http://localhost:3004",
  "http://localhost:3000",
]);

// Add AUTH_URL to allowed origins at startup
const authUrl = process.env.AUTH_URL;
if (authUrl) {
  try {
    ALLOWED_ORIGINS.add(new URL(authUrl).origin);
  } catch {
    // invalid AUTH_URL — skip
  }
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Routes exempt from CSRF checks (external callers like Stripe webhooks, probes)
const CSRF_EXEMPT_PATHS = [
  "/api/billing/webhook",
  "/api/billing/freedom/webhook",
  "/api/health",
  "/api/ready",
  "/api/metrics",
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

// ─── P3-41: CSP Nonce Generation ────────────────────────────────────────────
// Generates a per-request nonce for script-src, replacing broad 'unsafe-inline'.
// The nonce is set via the x-nonce request header so that Next.js can read it
// in server components / layout if needed.

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Base64 encode
  let binary = "";
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// Build CSP string with nonce
function buildCsp(nonce: string): string {
  const cdnHost = process.env.CDN_URL
    ? (() => {
        try {
          return new URL(process.env.CDN_URL).origin;
        } catch {
          return "";
        }
      })()
    : "";
  const sentryDsn = process.env.SENTRY_DSN ?? "";
  const sentryHost = sentryDsn
    ? (() => {
        try {
          return new URL(sentryDsn).origin;
        } catch {
          return "";
        }
      })()
    : "";
  const cspExtraSrc = [cdnHost, sentryHost].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    // nonce + strict-dynamic: nonce-tagged scripts can load further scripts;
    // 'unsafe-inline' is kept as a fallback for browsers that don't support nonce
    // (CSP3 spec: 'unsafe-inline' is ignored when a nonce is present in compliant browsers)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://static.cloudflareinsights.com ${cspExtraSrc}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${cdnHost}`.trim(),
    `font-src 'self' data: ${cdnHost}`.trim(),
    `connect-src 'self' https://*.sentry.io https://*.cloudflare.com https://static.cloudflareinsights.com https://api.moonshot.cn https://api.deepinfra.com https://api.stripe.com wss: ${cspExtraSrc}`.trim(),
    "media-src 'self' blob: https:",
    "frame-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
  ].join("; ");
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { method, nextUrl } = request;
  const pathname = nextUrl.pathname;

  // --- P3-40: CSRF Origin check for state-changing methods ---
  if (STATE_CHANGING_METHODS.has(method) && !isCsrfExempt(pathname)) {
    // Allow requests with Bearer tokens (API consumers / cron jobs)
    const authHeader = request.headers.get("authorization") ?? "";
    const hasBearerToken = authHeader.toLowerCase().startsWith("bearer ");

    if (!hasBearerToken) {
      const origin = request.headers.get("origin");

      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return new NextResponse(
          JSON.stringify({ error: "CSRF validation failed: invalid origin" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  }

  // --- P3-41: Nonce-based CSP ---
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Pass nonce downstream via request header so server components can use it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP header on the response (overrides the static one from next.config.ts)
  response.headers.set("Content-Security-Policy", csp);
  // Also expose nonce for inline script injection in _document / layout
  response.headers.set("x-nonce", nonce);

  return response;
}

// Match all routes except static files and images
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Static assets with common extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
