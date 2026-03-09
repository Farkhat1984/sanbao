import { NextResponse } from "next/server";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { verifyAppleToken } from "@/lib/mobile-auth";
import { getClientIp, handleOAuthLogin, OAuthEmailRequiredError } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    // Rate limit
    const ip = getClientIp(req);

    const rateCheck = await checkAuthRateLimit(`apple:${ip}`);
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
    const { identityToken, email, fullName, nonce } = body as {
      identityToken?: string;
      email?: string;
      fullName?: { givenName?: string; familyName?: string };
      nonce?: string;
    };

    if (!identityToken || typeof identityToken !== "string") {
      return jsonError("identityToken is required", 400);
    }

    // Verify Apple identity token
    let applePayload;
    try {
      applePayload = await verifyAppleToken(identityToken, nonce);
    } catch {
      return jsonError("Invalid Apple identity token", 401);
    }

    const appleSub = applePayload.sub;
    // Apple sends email only on first auth; use from request body as fallback
    const appleEmail =
      applePayload.email || (email ? email.toLowerCase().trim() : null);

    // Build display name from fullName (Apple sends it only on first auth)
    const displayName = fullName
      ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ") ||
        null
      : null;

    const result = await handleOAuthLogin({
      provider: "apple",
      providerAccountId: appleSub,
      email: appleEmail,
      name: displayName,
      fallbackEmail: `apple_${appleSub}@privaterelay.appleid.com`,
    });

    return jsonOk({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      // Legacy field for backward compat
      token: result.accessToken,
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof OAuthEmailRequiredError) {
      return jsonError("Apple account has no email", 400);
    }
    console.error("[AUTH:APPLE] error:", error);
    return jsonError("Internal server error", 500);
  }
}
