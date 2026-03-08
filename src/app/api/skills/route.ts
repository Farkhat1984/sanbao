import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON, SKILL_CATEGORIES } from "@/lib/constants";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { skillCreateSchema } from "@/lib/validation";
import { type Prisma } from "@prisma/client";

const VALID_CATEGORY_VALUES = SKILL_CATEGORIES.map((c) => c.value);

export async function GET(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { searchParams } = new URL(req.url);
  const marketplace = searchParams.get("marketplace") === "true";
  const category = searchParams.get("category");
  const sort = searchParams.get("sort"); // "popular" | default (newest)

  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 200);

  const where: Prisma.SkillWhereInput = marketplace
    ? { isPublic: true }
    : {
        OR: [
          { isBuiltIn: true },
          { userId },
        ],
      };

  if (category && VALID_CATEGORY_VALUES.includes(category as typeof VALID_CATEGORY_VALUES[number])) {
    where.category = category as typeof VALID_CATEGORY_VALUES[number];
  }

  const orderBy: Prisma.SkillOrderByWithRelationInput[] =
    sort === "popular"
      ? [{ usageCount: "desc" }, { updatedAt: "desc" }]
      : [{ isBuiltIn: "desc" }, { updatedAt: "desc" }];

  const skills = await prisma.skill.findMany({
    where,
    orderBy,
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
      category: true,
      tags: true,
      usageCount: true,
      version: true,
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
  const {
    name, description, systemPrompt, templates, citationRules,
    jurisdiction, icon, iconColor, category, tags,
  } = parsed.data;

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
      category: category || "CUSTOM",
      tags: tags || [],
    },
  });

  return jsonOk(serializeDates(skill), 201);
}
