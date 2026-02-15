import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { toolCreateSchema } from "@/lib/validation";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const tools = await prisma.tool.findMany({
    where: {
      OR: [
        { userId },
        { isGlobal: true },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return jsonOk(tools.map(serializeDates));
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = toolCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }

  const { config, inputSchema, ...rest } = parsed.data;
  const tool = await prisma.tool.create({
    data: {
      userId,
      ...rest,
      config: config as Prisma.InputJsonValue,
      ...(inputSchema ? { inputSchema: inputSchema as Prisma.InputJsonValue } : {}),
    },
  });

  return jsonOk(serializeDates(tool), 201);
}
