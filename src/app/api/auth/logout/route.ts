import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Clear session cookies server-side to ensure full logout.
 */
export async function POST() {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Secure-authjs.csrf-token",
  ];

  const response = NextResponse.json({ success: true });

  for (const name of cookieNames) {
    // Clear cookie without explicit domain (exact host)
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      secure: isProduction,
      sameSite: "lax",
      httpOnly: name.includes("session-token"),
    });
    // Also clear cookie on .sanbao.ai domain (covers www + root)
    if (isProduction) {
      response.cookies.set(name, "", {
        path: "/",
        expires: new Date(0),
        secure: true,
        sameSite: "lax",
        httpOnly: name.includes("session-token"),
        domain: ".sanbao.ai",
      });
    }
  }

  return response;
}
