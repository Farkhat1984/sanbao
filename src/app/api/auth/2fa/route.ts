import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OTP } from "otplib";
import QRCode from "qrcode";
import { checkRateLimit } from "@/lib/rate-limit";

const otp = new OTP();

/** GET — generate a new TOTP secret + QR code for setup */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ enabled: true });
  }

  const secret = otp.generateSecret();
  const otpauth = otp.generateURI({ issuer: "Sanbao", label: user.email!, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: secret },
  });

  return NextResponse.json({ secret, qrCodeUrl, enabled: false });
}

/** POST — verify TOTP code and enable/disable 2FA */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 attempts per minute per user to prevent TOTP brute-force
  const allowed = await checkRateLimit(`2fa:${session.user.id}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите минуту." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const code = String(body.code || "").replace(/\s/g, "");
  const action = body.action;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Enable 2FA
  if (action === "enable") {
    if (!user.twoFactorSecret || !code) {
      return NextResponse.json({ error: "Secret not set or code missing" }, { status: 400 });
    }

    const result = await otp.verify({ token: code, secret: user.twoFactorSecret });
    if (!result.valid) {
      return NextResponse.json({ error: "Неверный код" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true, enabled: true });
  }

  // Disable 2FA
  if (action === "disable") {
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Администраторы не могут отключить 2FA" }, { status: 403 });
    }
    if (!user.twoFactorSecret || !code) {
      return NextResponse.json({ error: "Code required to disable 2FA" }, { status: 400 });
    }

    const result = await otp.verify({ token: code, secret: user.twoFactorSecret });
    if (!result.valid) {
      return NextResponse.json({ error: "Неверный код" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return NextResponse.json({ success: true, enabled: false });
  }

  // Verify code (for login flow)
  if (action === "verify") {
    if (!user.twoFactorSecret || !code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    const result = await otp.verify({ token: code, secret: user.twoFactorSecret });
    return NextResponse.json({ valid: result.valid });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
