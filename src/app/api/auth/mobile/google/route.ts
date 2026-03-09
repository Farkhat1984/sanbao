import { NextResponse } from "next/server";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { verifyGoogleIdToken } from "@/lib/mobile-auth";
import { getClientIp, handleOAuthLogin, OAuthEmailRequiredError } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    // Rate limit
    const ip = getClientIp(req);

    const rateCheck = await checkAuthRateLimit(`google-mobile:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds ?? 900),
          },
        }
      );
    }

    const body = await req.json();
    const { idToken } = body as { idToken?: string };

    if (!idToken || typeof idToken !== "string") {
      return jsonError("idToken is required", 400);
    }

    // Verify Google ID token
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch {
      return jsonError("Invalid Google ID token", 401);
    }

    const googleSub = googlePayload.sub;
    const googleEmail = googlePayload.email?.toLowerCase().trim() ?? null;
    const googleName = googlePayload.name ?? null;
    const googlePicture = googlePayload.picture ?? null;

    const result = await handleOAuthLogin({
      provider: "google",
      providerAccountId: googleSub,
      email: googleEmail,
      name: googleName,
      image: googlePicture,
    });

    return jsonOk({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      // Legacy field for backward compat
      token: result.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
      },
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof OAuthEmailRequiredError) {
      return jsonError("Google account has no email", 400);
    }
    console.error("[AUTH:GOOGLE-MOBILE] error:", error);
    return jsonError("Internal server error", 500);
  }
}
