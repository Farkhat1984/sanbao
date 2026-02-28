import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { skillCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const marketplace = searchParams.get("marketplace") === "true";

  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 200);

  const skills = await prisma.skill.findMany({
    where: marketplace
      ? { isPublic: true }
      : {
          OR: [
            { isBuiltIn: true },
            { userId },
          ],
        },
    orderBy: [{ isBuiltIn: "desc" }, { updatedAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      description: true,
      jurisdiction: true,
      icon: true,
      iconColor: true,
      isBuiltIn: true,
      isPublic: true,
      systemPrompt: true,
      citationRules: true,
      templates: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = skills.length > limit;
  const items = hasMore ? skills.slice(0, limit) : skills;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return jsonOk({ items: items.map(serializeDates), nextCursor });
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = skillCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor } = parsed.data;

  const skill = await prisma.skill.create({
    data: {
      userId,
      name,
      description,
      systemPrompt,
      ...(templates ? { templates } : {}),
      citationRules,
      jurisdiction,
      icon: icon || DEFAULT_SKILL_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
    },
  });

  return jsonOk(serializeDates(skill), 201);
}
