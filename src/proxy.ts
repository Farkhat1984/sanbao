import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// ─── Correlation ID ───

const CORRELATION_HEADER = "x-request-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrCreateRequestId(req: Request): string {
  const provided = req.headers.get(CORRELATION_HEADER);
  return provided && UUID_PATTERN.test(provided) ? provided : crypto.randomUUID();
}

// ─── Security headers ───

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  return response;
}

// ─── Suspicious patterns ───

const SUSPICIOUS = /(\.\.|%2e%2e|%00|<script|javascript:|data:text\/html)/i;

// ─── Main proxy ───

export default auth((req) => {
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

  // Forward x-request-id to API routes via request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CORRELATION_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set on response so nginx / client can see it
  response.headers.set(CORRELATION_HEADER, requestId);

  addSecurityHeaders(response);
  return response;
});

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
    "/admin/:path*",
    "/api/:path*",
  ],
};
