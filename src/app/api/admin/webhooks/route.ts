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
