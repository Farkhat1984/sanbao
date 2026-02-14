import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateModelCache } from "@/lib/model-router";
import { encrypt } from "@/lib/crypto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const provider = await prisma.aiProvider.findUnique({
    where: { id },
    include: { models: { orderBy: { displayName: "asc" } } },
  });

  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...provider,
    apiKey: provider.apiKey ? `${provider.apiKey.slice(0, 8)}...${provider.apiKey.slice(-4)}` : "",
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  const allowedFields = ["name", "slug", "baseUrl", "apiKey", "isActive", "priority"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = field === "apiKey" ? encrypt(body[field]) : body[field];
    }
  }

  const updated = await prisma.aiProvider.update({ where: { id }, data });
  invalidateModelCache();

  return NextResponse.json({
    ...updated,
    apiKey: updated.apiKey ? `${updated.apiKey.slice(0, 8)}...${updated.apiKey.slice(-4)}` : "",
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  const provider = await prisma.aiProvider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  await prisma.aiProvider.delete({ where: { id } });
  invalidateModelCache();

  return NextResponse.json({ success: true });
}
