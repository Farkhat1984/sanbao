import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(codes);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { code, description, discount, maxUses, validUntil, planId } = await req.json();

  if (!code || !discount) {
    return NextResponse.json({ error: "code and discount required" }, { status: 400 });
  }

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Промокод уже существует" }, { status: 409 });
  }

  const promo = await prisma.promoCode.create({
    data: {
      code: code.toUpperCase(),
      description: description || null,
      discount: Math.min(100, Math.max(0, discount)),
      maxUses: maxUses || 0,
      validUntil: validUntil ? new Date(validUntil) : null,
      planId: planId || null,
    },
  });

  return NextResponse.json(promo, { status: 201 });
}
