import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const keys = await prisma.apiKey.findMany({
    take: 500,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Mask keys in response (safe access for pre/post-migration)
  const masked = keys.map((k) => {
    const rec = k as Record<string, unknown>;
    const prefix = rec.keyPrefix as string | undefined;
    const rawKey = k.key || "";
    return {
      ...k,
      key: prefix ? `${prefix}...` : rawKey.length > 12 ? `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}` : `${rawKey}...`,
      keyHash: undefined,
      keyPrefix: undefined,
    };
  });

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
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 12);

  // Build data with optional hash fields (graceful if DB schema not yet migrated)
  const data: Record<string, unknown> = {
    userId,
    name,
    key: keyPrefix, // Store only prefix, not plaintext
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    rateLimit: rateLimit || 60,
  };
  try {
    // Try with hash fields (post-migration)
    const apiKey = await prisma.apiKey.create({
      data: { ...data, keyHash, keyPrefix } as never,
    });
    return NextResponse.json({ ...apiKey, key, keyHash: undefined }, { status: 201 });
  } catch {
    // Fallback: hash fields not in DB yet — store prefix in key column
    const apiKey = await prisma.apiKey.create({ data: data as never });
    return NextResponse.json({ ...apiKey, key }, { status: 201 });
  }

}
