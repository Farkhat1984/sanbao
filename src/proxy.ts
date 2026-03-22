import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

// ─── Correlation ID ───

const CORRELATION_HEADER = "x-request-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrCreateRequestId(req: Request): string {
  const provided = req.headers.get(CORRELATION_HEADER);
  return provided && UUID_PATTERN.test(provided) ? provided : crypto.randomUUID();
}

// ─── Security headers ───

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=()"
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  return response;
}

// ─── Suspicious patterns ───

const SUSPICIOUS = /(\.\.|%2e%2e|%00|<script|javascript:|data:text\/html)/i;

// ─── Bearer-to-Cookie bridge for mobile clients ───

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

/** Validate JWT structure: three base64url segments with valid JSON header/payload */
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
function isValidJwtFormat(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  // Each part must be non-empty base64url
  if (!parts.every((p) => p.length > 0 && BASE64URL_RE.test(p))) return false;
  // Header must be valid JSON with "alg"
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (typeof header !== "object" || !header.alg) return false;
  } catch {
    return false;
  }
  return true;
}

// ─── P3-40: CSRF Origin Validation ───

const ALLOWED_ORIGINS = new Set([
  "https://sanbao.ai",
  "https://www.sanbao.ai",
  "http://localhost:3004",
  "http://localhost:3000",
  "https://localhost",        // Capacitor Android
  "capacitor://localhost",    // Capacitor iOS
]);

const authUrl = process.env.AUTH_URL;
if (authUrl) {
  try {
    ALLOWED_ORIGINS.add(new URL(authUrl).origin);
  } catch {
    // invalid AUTH_URL — skip
  }
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT_PATHS = [
  "/api/auth/",
  "/api/billing/webhook",
  "/api/billing/freedom/webhook",
  "/api/health",
  "/api/ready",
  "/api/metrics",
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

// ─── CSP ───
// Next.js injects inline scripts without nonce support in the App Router,
// so we must allow 'unsafe-inline' for scripts. 'strict-dynamic' + nonce
// would block all Next.js-generated scripts.

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io https://*.cloudflare.com https://static.cloudflareinsights.com https://api.moonshot.cn https://api.deepinfra.com https://api.stripe.com wss:",
  "media-src 'self' blob: https:",
  "frame-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

// ─── Main proxy ───

const withAuth = auth((req) => {
  const { pathname } = req.nextUrl;

  // Block suspicious paths/query strings
  if (SUSPICIOUS.test(pathname) || SUSPICIOUS.test(req.nextUrl.search)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ─── Auth route protection ───
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;

  const isAppRoute =
    pathname === "/" ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/skills") ||
    pathname.startsWith("/mcp") ||
    pathname.startsWith("/organizations") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/admin");

  if (isAppRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged-in user on root → go to chat
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  // IP whitelist for admin panel
  const adminWhitelist = process.env.ADMIN_IP_WHITELIST;
  if (pathname.startsWith("/admin") && adminWhitelist) {
    const allowed = adminWhitelist.split(",").map((ip) => ip.trim());
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "127.0.0.1";
    if (!allowed.includes(clientIp) && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      return new NextResponse("Access denied", { status: 403 });
    }
  }

  // Generate / propagate correlation ID
  const requestId = getOrCreateRequestId(req);

  // Forward headers to API routes
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CORRELATION_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CORRELATION_HEADER, requestId);
  response.headers.set("Content-Security-Policy", CSP);

  addSecurityHeaders(response);
  return response;
});

// ─── CORS helpers for Capacitor mobile clients ───

const MOBILE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

const ALLOWED_BUNDLE_IDS = new Set(
  (process.env.ALLOWED_CAPACITOR_BUNDLE_IDS || "ai.sanbao.app")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

const BUNDLE_ID_HEADER = "x-app-bundle-id";

function isMobileOrigin(origin: string | null): boolean {
  return !!origin && MOBILE_ORIGINS.has(origin);
}

/** Validate Capacitor bundle ID for capacitor:// origins. */
function isValidCapacitorRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Only enforce bundle ID check for capacitor:// origin
  if (origin !== "capacitor://localhost") return true;

  const bundleId = req.headers.get(BUNDLE_ID_HEADER);
  if (!bundleId) return false;

  return ALLOWED_BUNDLE_IDS.has(bundleId);
}

function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id, " + BUNDLE_ID_HEADER);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { method } = req;
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");

  // Validate Capacitor bundle ID for capacitor:// origins
  if (origin === "capacitor://localhost" && !isValidCapacitorRequest(req)) {
    return new NextResponse(
      JSON.stringify({ error: "Invalid or missing X-App-Bundle-Id header" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // CORS preflight for mobile clients
  if (method === "OPTIONS" && isMobileOrigin(origin)) {
    const res = new NextResponse(null, { status: 204 });
    return addCorsHeaders(res, origin!);
  }

  // P3-40: CSRF Origin check for state-changing methods (before auth)
  if (STATE_CHANGING_METHODS.has(method) && !isCsrfExempt(pathname)) {
    const authHeader = req.headers.get("authorization") ?? "";
    const hasBearerToken = authHeader.toLowerCase().startsWith("bearer ");

    if (!hasBearerToken) {
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

  // Inject Bearer token as session cookie so auth() can read it
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && !req.cookies.has(SESSION_COOKIE)) {
      const token = authHeader.slice(7);
      if (isValidJwtFormat(token)) {
        req.cookies.set(SESSION_COOKIE, token);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = (withAuth as any)(req, event) as Promise<NextResponse> | NextResponse;

  // Attach CORS headers for mobile origins
  if (isMobileOrigin(origin)) {
    if (response instanceof Promise) {
      return response.then((res) => addCorsHeaders(res, origin!));
    }
    return addCorsHeaders(response, origin!);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/chat/:path*",
    "/profile",
    "/settings",
    "/billing",
    "/agents/:path*",
    "/skills/:path*",
    "/mcp/:path*",
    "/organizations/:path*",
    "/invite/:path*",
    "/admin/:path*",
    "/api/:path*",
  ],
};
