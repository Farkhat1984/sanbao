import { NextResponse } from "next/server";
import { requireAdmin, resetIpWhitelistCache } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { resetContentFilterCache } from "@/lib/content-filter";
import { resetTransporter } from "@/lib/email";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const settings = await prisma.systemSetting.findMany({ take: 500 });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  return NextResponse.json(map);
}

export async function PUT(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();

  // Whitelist allowed setting keys to prevent arbitrary config injection
  const ALLOWED_KEYS = new Set([
    "content_filter_enabled",
    "content_filter_words",
    "admin_ip_whitelist",
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_password",
    "smtp_pass",
    "smtp_from",
    "maintenance_mode",
    "maintenance_message",
    "registration_enabled",
    "default_plan_id",
    "max_file_upload_mb",
    "max_upload_size_mb",
    "max_file_count",
    "app_name",
    "app_description",
    "default_language",
    "welcome_title",
    "welcome_message",
    "onboarding_enabled",
    "onboarding_steps",
    "session_ttl_hours",
    "google_oauth_enabled",
  ]);

  // Validate numeric settings to prevent NaN/Infinity/overflow
  const NUMERIC_RANGES: Record<string, [number, number]> = {
    smtp_port: [1, 65535],
    max_file_upload_mb: [1, 500],
  };
  const BOOLEAN_KEYS = new Set([
    "content_filter_enabled",
    "maintenance_mode",
    "registration_enabled",
    "onboarding_enabled",
    "google_oauth_enabled",
  ]);

  // body is { key: value, key2: value2, ... }
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: `Недопустимый ключ настройки: ${key}` }, { status: 400 });
    }

    let sanitized = String(value);

    if (NUMERIC_RANGES[key]) {
      const num = Number(sanitized);
      const [min, max] = NUMERIC_RANGES[key];
      if (!Number.isFinite(num) || num < min || num > max) {
        return NextResponse.json(
          { error: `Значение "${key}" должно быть числом от ${min} до ${max}` },
          { status: 400 }
        );
      }
      sanitized = String(Math.floor(num));
    }

    if (BOOLEAN_KEYS.has(key)) {
      sanitized = sanitized === "true" || sanitized === "1" ? "true" : "false";
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: sanitized },
      create: { key, value: sanitized },
    });
  }

  // Reset caches for settings that affect runtime
  if ("content_filter_enabled" in body || "content_filter_words" in body) {
    resetContentFilterCache();
  }
  if (Object.keys(body).some((k) => k.startsWith("smtp_"))) {
    resetTransporter();
  }
  if ("admin_ip_whitelist" in body) {
    resetIpWhitelistCache();
  }

  return NextResponse.json({ success: true });
}
