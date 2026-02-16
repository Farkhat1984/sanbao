import { NextResponse } from "next/server";
import { requireAdmin, resetIpWhitelistCache } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { resetContentFilterCache } from "@/lib/content-filter";
import { resetTransporter } from "@/lib/email";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const settings = await prisma.systemSetting.findMany();
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
    "smtp_from",
    "maintenance_mode",
    "maintenance_message",
    "registration_enabled",
    "default_plan_id",
    "max_file_upload_mb",
    "app_name",
    "app_description",
  ]);

  // body is { key: value, key2: value2, ... }
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: `Недопустимый ключ настройки: ${key}` }, { status: 400 });
    }
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
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
