import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { BCRYPT_SALT_ROUNDS, DEFAULT_SESSION_TTL_HOURS } from "./constants";
import { getSettingNumber } from "./settings";
import { cacheGet, cacheSet } from "./redis";
import { verifyTotpCode } from "./auth-utils";
import { logger } from "./logger";

const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// ─── Session TTL cache (Redis-first, in-memory fallback) ───
const REDIS_SESSION_TTL_KEY = "session_ttl_hours";
const REDIS_SESSION_TTL_EXPIRY_SECONDS = 60; // 1 minute in Redis
let sessionTtlCache: { value: number; expiresAt: number } | null = null;
const SESSION_TTL_CACHE_MS_FALLBACK = 5 * 60_000; // 5 minutes (in-memory fallback TTL)

async function getSessionCacheTtlMs(): Promise<number> {
  try {
    return await getSettingNumber("auth_session_cache_ttl_ms");
  } catch {
    return SESSION_TTL_CACHE_MS_FALLBACK;
  }
}

async function getSessionTtlHours(): Promise<number> {
  // L1: Try Redis (shared across all replicas)
  try {
    const cached = await cacheGet(REDIS_SESSION_TTL_KEY);
    if (cached !== null) {
      const parsed = parseInt(cached, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Redis unavailable — fall through to DB then in-memory
  }

  // L2: In-memory cache (per-instance fallback when Redis is down)
  const cacheTtlMs = await getSessionCacheTtlMs();
  if (sessionTtlCache && sessionTtlCache.expiresAt > Date.now()) {
    return sessionTtlCache.value;
  }

  // L3: Query DB
  try {
    const ttlSetting = await prisma.systemSetting.findUnique({
      where: { key: "session_ttl_hours" },
    });
    const parsed = ttlSetting ? parseInt(ttlSetting.value, 10) : DEFAULT_SESSION_TTL_HOURS;
    const ttlHours = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8760) : DEFAULT_SESSION_TTL_HOURS;

    // Write back to both caches
    sessionTtlCache = { value: ttlHours, expiresAt: Date.now() + cacheTtlMs };
    await cacheSet(REDIS_SESSION_TTL_KEY, String(ttlHours), REDIS_SESSION_TTL_EXPIRY_SECONDS).catch(() => {});

    return ttlHours;
  } catch {
    return sessionTtlCache?.value ?? DEFAULT_SESSION_TTL_HOURS;
  }
}

// ─── Custom adapter: prevent auto-linking when user already has a Google account ───
// Google can return the same email for different Google accounts (e.g. linked accounts).
// Default PrismaAdapter would merge them into one User. This wrapper intercepts linkAccount
// to detect and fix this before the Account record is created.
function createAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  const originalLinkAccount = base.linkAccount!.bind(base);

  base.linkAccount = async (account): Promise<void> => {
    // Check if this user already has a DIFFERENT OAuth account for the same provider
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: account.userId,
        provider: account.provider,
      },
    });

    if (existingAccount && existingAccount.providerAccountId !== account.providerAccountId) {
      // User already has a different Google account linked.
      // Create a separate user for this new Google account.
      const existingUser = await prisma.user.findUnique({
        where: { id: account.userId },
        select: { email: true, name: true, image: true },
      });

      const uniqueEmail = `${account.provider}_${account.providerAccountId}@oauth.sanbao.ai`;
      const newUser = await prisma.user.create({
        data: {
          email: uniqueEmail,
          name: existingUser?.name ?? null,
          image: existingUser?.image ?? null,
          emailVerified: new Date(),
        },
      });

      // Auto-assign free subscription
      const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
      if (freePlan) {
        await prisma.subscription.upsert({
          where: { userId: newUser.id },
          update: {},
          create: { userId: newUser.id, planId: freePlan.id },
        });
      }

      logger.info("Created separate user for duplicate OAuth provider", {
        context: "AUTH",
        provider: account.provider,
        newUserId: newUser.id,
        originalUserId: account.userId,
      });

      // Link to the new user instead
      account.userId = newUser.id;
    }

    await originalLinkAccount(account);
  };

  return base;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — must match DEFAULT_SESSION_TTL_HOURS
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // .sanbao.ai covers both sanbao.ai and www.sanbao.ai
        domain: process.env.NODE_ENV === "production" ? ".sanbao.ai" : undefined,
      },
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/chat",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const login = (credentials.email as string).trim();
          const password = credentials.password as string;

          // Check admin credentials (disabled when ADMIN_PASSWORD or ADMIN_EMAIL is not set)
          if (
            ADMIN_PASSWORD &&
            ADMIN_EMAIL &&
            (login === ADMIN_LOGIN || login === ADMIN_EMAIL) &&
            password.length === ADMIN_PASSWORD.length &&
            timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD))
          ) {
            // Upsert admin user in DB
            const admin = await prisma.user.upsert({
              where: { email: ADMIN_EMAIL },
              update: { role: "ADMIN" },
              create: {
                email: ADMIN_EMAIL,
                name: "Администратор",
                password: await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS),
                role: "ADMIN",
              },
            });

            // Enforce 2FA for admin if enabled
            if (admin.twoFactorEnabled && admin.twoFactorSecret) {
              const totpCode = credentials.totpCode as string | undefined;
              if (!totpCode) {
                throw new Error("2FA_REQUIRED");
              }
              const valid = await verifyTotpCode(admin.twoFactorSecret, totpCode);
              if (!valid) {
                throw new Error("2FA_INVALID");
              }
            }

            return {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              image: admin.image,
            };
          }

          // Regular user authentication
          const user = await prisma.user.findUnique({
            where: { email: login },
          });

          if (!user || !user.password) return null;

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) return null;

          // 2FA check
          if (user.twoFactorEnabled && user.twoFactorSecret) {
            const totpCode = credentials.totpCode as string | undefined;
            if (!totpCode) {
              throw new Error("2FA_REQUIRED");
            }
            const valid = await verifyTotpCode(user.twoFactorSecret, totpCode);
            if (!valid) {
              throw new Error("2FA_INVALID");
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          // Re-throw 2FA errors so the client can handle them
          if (error instanceof Error && (error.message === "2FA_REQUIRED" || error.message === "2FA_INVALID")) {
            throw error;
          }
          logger.error("Authorize error", { context: "AUTH", error: error instanceof Error ? error.message : String(error) });
          return null;
        }
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Auto-assign free subscription for new OAuth users
      if (user.id) {
        const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
        if (freePlan) {
          await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, planId: freePlan.id },
          });
        }
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        let userId = user.id as string;

        // If linkAccount redirected to a different user (duplicate OAuth provider),
        // resolve the actual user from the Account table.
        if (account?.provider && account?.providerAccountId) {
          const linked = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            select: { userId: true },
          });
          if (linked && linked.userId !== userId) {
            userId = linked.userId;
          }
        }

        token.id = userId;
        token.iat = Math.floor(Date.now() / 1000);
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, twoFactorEnabled: true, securityStamp: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          // If user has 2FA enabled and reached this point, they passed verification
          token.twoFactorVerified = dbUser.twoFactorEnabled || false;
          // Store security stamp so we can detect 2FA changes mid-session
          token.securityStamp = dbUser.securityStamp?.toISOString() ?? null;
        }
      }

      // Check if security stamp changed (e.g. 2FA enabled/disabled) — invalidate session.
      // Throttled: only check every 60s to avoid a DB query on every request.
      if (token.id && token.securityStamp) {
        const lastStampCheck = (token.securityStampCheckedAt as number) || 0;
        const now = Math.floor(Date.now() / 1000);
        if (now - lastStampCheck > 60) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { securityStamp: true },
          });
          token.securityStampCheckedAt = now;
          if (dbUser?.securityStamp && dbUser.securityStamp.toISOString() !== token.securityStamp) {
            return { ...token, expired: true };
          }
        }
      }

      // Session TTL enforcement from SystemSettings (cached)
      if (token.iat) {
        const ttlHours = await getSessionTtlHours();
        const maxAge = ttlHours * 3600;
        const now = Math.floor(Date.now() / 1000);
        if (now - (token.iat as number) > maxAge) {
          return { ...token, expired: true };
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.expired) {
        // Force logout by returning empty session
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "USER";
        session.user.twoFactorVerified = (token.twoFactorVerified as boolean) || false;
      }
      return session;
    },
  },
});
