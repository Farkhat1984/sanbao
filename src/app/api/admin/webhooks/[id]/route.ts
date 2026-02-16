import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return NextResponse.json({ error: "Вебхук не найден" }, { status: 404 });
  }

  // SSRF protection on URL update
  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url.trim());
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
  }

  const allowedFields = ["url", "events", "isActive"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const updated = await prisma.webhook.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return NextResponse.json({ error: "Вебхук не найден" }, { status: 404 });
  }

  await prisma.webhook.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
