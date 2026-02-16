import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const memories = await prisma.userMemory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return jsonOk(memories.map(serializeDates));
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { key, content, source } = body;

  if (!key?.trim() || !content?.trim()) {
    return jsonError("Ключ и содержимое обязательны", 400);
  }

  const memory = await prisma.userMemory.upsert({
    where: {
      userId_key: { userId, key: key.trim() },
    },
    create: {
      userId,
      key: key.trim(),
      content: content.trim(),
      source: source || "manual",
    },
    update: {
      content: content.trim(),
      source: source || "manual",
    },
  });

  return jsonOk(serializeDates(memory), 201);
}
