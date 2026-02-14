import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const keys = await prisma.apiKey.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Mask keys in response
  const masked = keys.map((k) => ({
    ...k,
    key: `${k.key.slice(0, 8)}...${k.key.slice(-4)}`,
  }));

  return NextResponse.json(masked);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { userId, name, expiresAt, rateLimit } = body;

  if (!userId || !name) {
    return NextResponse.json({ error: "Обязательные поля: userId, name" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const key = `lma_${randomBytes(32).toString("hex")}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      key,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      rateLimit: rateLimit || 60,
    },
  });

  // Return full key only on creation
  return NextResponse.json(apiKey, { status: 201 });
}
