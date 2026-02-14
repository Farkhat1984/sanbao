import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/admin");

  if (isAppRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  // Add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
});

export const config = {
  matcher: [
    "/chat/:path*",
    "/profile",
    "/settings",
    "/billing",
    "/agents/:path*",
    "/admin/:path*",
  ],
};
