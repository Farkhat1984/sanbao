import { encode } from "@auth/core/jwt";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

interface MintParams {
  id: string;
  email: string | null;
  name: string | null;
  image?: string | null;
  role: string;
  twoFactorVerified: boolean;
}

export async function mintSessionToken(user: MintParams): Promise<{
  token: string;
  expiresAt: string;
}> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    salt: COOKIE_NAME,
    secret,
    maxAge: SESSION_MAX_AGE,
    token: {
      id: user.id,
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image ?? null,
      role: user.role,
      twoFactorVerified: user.twoFactorVerified,
      iat: now,
    },
  });

  return {
    token,
    expiresAt: new Date((now + SESSION_MAX_AGE) * 1000).toISOString(),
  };
}
