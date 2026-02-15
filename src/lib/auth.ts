import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { BCRYPT_SALT_ROUNDS, DEFAULT_SESSION_TTL_HOURS } from "./constants";

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sanbao.local";

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
            password === ADMIN_PASSWORD
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
            const result2fa = await otpInstance.verify({ token: totpCode, secret: user.twoFactorSecret });
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
          console.error("[AUTH] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.iat = Math.floor(Date.now() / 1000);
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }

      // Session TTL enforcement from SystemSettings
      if (token.iat) {
        try {
          const ttlSetting = await prisma.systemSetting.findUnique({
            where: { key: "session_ttl_hours" },
          });
          const ttlHours = ttlSetting ? parseInt(ttlSetting.value, 10) : DEFAULT_SESSION_TTL_HOURS;
          const maxAge = ttlHours * 3600;
          const now = Math.floor(Date.now() / 1000);
          if (now - (token.iat as number) > maxAge) {
            return { ...token, expired: true };
          }
        } catch {
          // DB not available — allow session
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
      }
      return session;
    },
  },
});
