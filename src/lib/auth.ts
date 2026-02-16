import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { BCRYPT_SALT_ROUNDS, DEFAULT_SESSION_TTL_HOURS } from "./constants";

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sanbao.local";

// ─── Session TTL cache (avoid DB query on every JWT validation) ───
let sessionTtlCache: { value: number; expiresAt: number } | null = null;
const SESSION_TTL_CACHE_MS = 5 * 60_000; // 5 minutes

async function getSessionTtlHours(): Promise<number> {
  if (sessionTtlCache && sessionTtlCache.expiresAt > Date.now()) {
    return sessionTtlCache.value;
  }
  try {
    const ttlSetting = await prisma.systemSetting.findUnique({
      where: { key: "session_ttl_hours" },
    });
    const parsed = ttlSetting ? parseInt(ttlSetting.value, 10) : DEFAULT_SESSION_TTL_HOURS;
    const ttlHours = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8760) : DEFAULT_SESSION_TTL_HOURS;
    sessionTtlCache = { value: ttlHours, expiresAt: Date.now() + SESSION_TTL_CACHE_MS };
    return ttlHours;
  } catch {
    return DEFAULT_SESSION_TTL_HOURS;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/chat",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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

          // Check admin credentials (disabled when ADMIN_PASSWORD is not set)
          if (
            ADMIN_PASSWORD &&
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
              const { OTP } = await import("otplib");
              const otpInstance = new OTP();
              const decryptedSecret = decrypt(admin.twoFactorSecret);
              const result2fa = await otpInstance.verify({
                token: totpCode,
                secret: decryptedSecret,
              });
              if (!result2fa.valid) {
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
            const { OTP } = await import("otplib");
            const otpInstance = new OTP();
            const decryptedSecret = decrypt(user.twoFactorSecret);
            const result2fa = await otpInstance.verify({ token: totpCode, secret: decryptedSecret });
            if (!result2fa.valid) {
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
          console.error("[AUTH] authorize error:", error);
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.iat = Math.floor(Date.now() / 1000);
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true, twoFactorEnabled: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          // If user has 2FA enabled and reached this point, they passed verification
          token.twoFactorVerified = dbUser.twoFactorEnabled || false;
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
