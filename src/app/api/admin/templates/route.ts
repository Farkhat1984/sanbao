import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const jurisdiction = searchParams.get("jurisdiction");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (jurisdiction) where.jurisdiction = jurisdiction;

  const templates = await prisma.documentTemplate.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, type, content, jurisdiction, isActive } = body;

  if (!name || !type || !content) {
    return NextResponse.json({ error: "Обязательные поля: name, type, content" }, { status: 400 });
  }

  const template = await prisma.documentTemplate.create({
    data: {
      name,
      type,
      content,
      jurisdiction: jurisdiction || "RU",
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
