import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OTP } from "otplib";
import QRCode from "qrcode";
import { checkRateLimit } from "@/lib/rate-limit";
import { encrypt, decrypt } from "@/lib/crypto";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { getSettingNumber } from "@/lib/settings";

const otp = new OTP();

/** GET — generate a new TOTP secret + QR code for setup */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    return jsonError("User not found", 404);
  }

  if (user.twoFactorEnabled) {
    return jsonOk({ enabled: true });
  }

  const secret = otp.generateSecret();
  const otpauth = otp.generateURI({ issuer: "Sanbao", label: user.email!, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  // Encrypt secret before storing in DB
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encrypt(secret) },
  });

  // Security: do NOT return the raw TOTP secret in the response.
  // The QR code data URL encodes the otpauth:// URI which contains the secret,
  // but only in a form that authenticator apps can scan — not easily copy-pasted.
  // Exposing the raw secret makes it trivial to clone the TOTP generator.
  return jsonOk({ qrCodeUrl, enabled: false });
}

/** POST — verify TOTP code and enable/disable 2FA */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  // Rate limit: prevent TOTP brute-force
  const rate2fa = await getSettingNumber('rate_2fa_per_minute');
  const allowed = await checkRateLimit(`2fa:${session.user.id}`, rate2fa, 60_000);
  if (!allowed) {
    return jsonError("Слишком много попыток. Подождите минуту.", 429);
  }

  const body = await req.json();
  const code = String(body.code || "").replace(/\s/g, "");
  const action = body.action;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true, role: true },
  });

  if (!user) {
    return jsonError("User not found", 404);
  }

  // Enable 2FA
  if (action === "enable") {
    if (!user.twoFactorSecret || !code) {
      return jsonError("Secret not set or code missing", 400);
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);
    const result = await otp.verify({ token: code, secret: decryptedSecret });
    if (!result.valid) {
      return jsonError("Неверный код", 400);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true, securityStamp: new Date() },
    });

    return jsonOk({ success: true, enabled: true });
  }

  // Disable 2FA
  if (action === "disable") {
    if (user.role === "ADMIN") {
      return jsonError("Администраторы не могут отключить 2FA", 403);
    }
    if (!user.twoFactorSecret || !code) {
      return jsonError("Code required to disable 2FA", 400);
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);
    const result = await otp.verify({ token: code, secret: decryptedSecret });
    if (!result.valid) {
      return jsonError("Неверный код", 400);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, securityStamp: new Date() },
    });

    return jsonOk({ success: true, enabled: false });
  }

  // Verify code (for login flow)
  if (action === "verify") {
    if (!user.twoFactorSecret || !code) {
      return jsonError("Code required", 400);
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);
    const result = await otp.verify({ token: code, secret: decryptedSecret });
    return jsonOk({ valid: result.valid });
  }

  return jsonError("Invalid action", 400);
}
