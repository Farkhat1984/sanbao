import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Hardcoded admin credentials
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Ckdshfh231161!";
const ADMIN_EMAIL = "admin@leema.local";

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
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const login = (credentials.email as string).trim();
          const password = credentials.password as string;

          // Check hardcoded admin credentials
          if (
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
                password: await bcrypt.hash(ADMIN_PASSWORD, 12),
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
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "USER";
      }
      return session;
    },
  },
});
