import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { PASSWORD_MIN_LENGTH, BCRYPT_SALT_ROUNDS } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    // Rate limit registration by IP
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const ip = cfIp || forwarded?.split(",")[0]?.trim() || "unknown";

    const rateCheck = await checkAuthRateLimit(`reg:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 900) } }
      );
    }

    const { name, email, password } = await req.json();

    // Validate email format + length (RFC 5321: max 254 chars)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || email.length > 254 || !emailRegex.test(email)) {
      return jsonError("Некорректный email", 400);
    }

    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      return jsonError("Пароль должен быть минимум 8 символов", 400);
    }

    // Prevent bcrypt DoS — bcrypt truncates at 72 bytes anyway
    if (password.length > 128) {
      return jsonError("Пароль не должен превышать 128 символов", 400);
    }

    // Sanitize name (strip HTML tags)
    const sanitizedName = name
      ? String(name).replace(/<[^>]*>/g, "").trim().slice(0, 100)
      : null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Пользователь с таким email уже существует", 409);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      },
    });

    // Auto-assign free subscription
    const freePlan = await prisma.plan.findFirst({ where: { isDefault: true } });
    if (freePlan) {
      await prisma.subscription.create({
        data: { userId: user.id, planId: freePlan.id },
      });
    }

    return jsonOk({ success: true }, 201);
  } catch (error) {
    console.error("Registration error:", error);
    return jsonError("Внутренняя ошибка сервера", 500);
  }
}
