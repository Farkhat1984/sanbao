import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(webhooks);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { url, events, isActive } = body;

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "Обязательные поля: url, events[]" }, { status: 400 });
  }

  // SSRF protection: block internal/private URLs
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "URL должен использовать http или https" }, { status: 400 });
    }
    const BLOCKED_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1?\]|metadata\.google|169\.254\.\d+\.\d+)/i;
    if (BLOCKED_HOSTS.test(parsed.hostname)) {
      return NextResponse.json({ error: "URL указывает на внутреннюю сеть" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  const webhook = await prisma.webhook.create({
    data: {
      url,
      events,
      secret,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(webhook, { status: 201 });
}
