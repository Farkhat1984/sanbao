import { createRemoteJWKSet, jwtVerify } from "jose";

// ─── Apple ID Token Verification ───

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_BUNDLE_ID = "com.sanbao.sanbaoai";

export interface AppleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
}

export async function verifyAppleToken(
  identityToken: string,
  nonce?: string
): Promise<AppleTokenPayload> {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: APPLE_BUNDLE_ID,
  });

  if (nonce && payload.nonce !== nonce) {
    throw new Error("Apple token nonce mismatch");
  }

  return {
    sub: payload.sub!,
    email: payload.email as string | undefined,
    email_verified: payload.email_verified as boolean | undefined,
    is_private_email: payload.is_private_email as boolean | undefined,
  };
}

// ─── Google ID Token Verification ───

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
];

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function getGoogleAudiences(): string[] {
  const audiences: string[] = [];
  if (process.env.AUTH_GOOGLE_ID) audiences.push(process.env.AUTH_GOOGLE_ID);
  if (process.env.GOOGLE_IOS_CLIENT_ID)
    audiences.push(process.env.GOOGLE_IOS_CLIENT_ID);
  if (process.env.GOOGLE_ANDROID_CLIENT_ID)
    audiences.push(process.env.GOOGLE_ANDROID_CLIENT_ID);
  return audiences;
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleTokenPayload> {
  const audiences = getGoogleAudiences();
  if (audiences.length === 0) {
    throw new Error("No Google client IDs configured");
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
  });

  return {
    sub: payload.sub!,
    email: payload.email as string | undefined,
    email_verified: payload.email_verified as boolean | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}
