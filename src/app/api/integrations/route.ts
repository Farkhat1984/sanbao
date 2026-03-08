import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { integrationCreateSchema } from "@/lib/validation";
import { encrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";

const INTEGRATION_SELECT = {
  id: true,
  name: true,
  type: true,
  baseUrl: true,
  status: true,
  statusMessage: true,
  entityCount: true,
  lastDiscoveredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  const items = await prisma.integration.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: INTEGRATION_SELECT,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return jsonOk({
    items: items.map(serializeDates),
    nextCursor,
    hasMore,
  });
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = integrationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }
  const { name, type, baseUrl, username, password } = parsed.data;

  // SSRF check
  const safe = await isUrlSafeAsync(baseUrl);
  if (!safe) {
    return jsonError("Недопустимый URL (доступ к внутренним сетям запрещён)", 400);
  }

  // Encrypt credentials as Basic auth
  const credentials = encrypt(Buffer.from(`${username}:${password}`).toString("base64"));

  const integration = await prisma.integration.create({
    data: {
      userId,
      name,
      type,
      baseUrl: baseUrl.replace(/\/+$/, ""), // trim trailing slashes
      credentials,
    },
    select: INTEGRATION_SELECT,
  });

  return jsonOk(serializeDates(integration), 201);
}
