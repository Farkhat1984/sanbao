import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { PASSWORD_MIN_LENGTH, BCRYPT_SALT_ROUNDS } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    // Rate limit registration by IP
    const forwarded = req.headers.get("x-forwarded-for");
    const cfIp = req.headers.get("cf-connecting-ip");
    const ip = cfIp || forwarded?.split(",")[0]?.trim() || "unknown";

    const rateCheck = checkAuthRateLimit(`reg:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 900) } }
      );
    }

    const { name, email, password } = await req.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Некорректный email" },
        { status: 400 }
      );
    }

    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Пароль должен быть минимум 8 символов" },
        { status: 400 }
      );
    }

    // Sanitize name (strip HTML tags)
    const sanitizedName = name
      ? String(name).replace(/<[^>]*>/g, "").trim().slice(0, 100)
      : null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await prisma.user.create({
      data: {
        name: sanitizedName,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
