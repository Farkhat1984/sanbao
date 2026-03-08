import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON, SKILL_CATEGORIES } from "@/lib/constants";
import { parsePagination } from "@/lib/validation";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { type Prisma } from "@prisma/client";

const VALID_CATEGORY_VALUES = SKILL_CATEGORIES.map((c) => c.value);

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // builtin | public | all
  const category = searchParams.get("category");
  const sort = searchParams.get("sort"); // popular | newest (default)
  const q = searchParams.get("q");
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const where: Prisma.SkillWhereInput = {};

  if (type === "builtin") where.isBuiltIn = true;
  if (type === "public") where.isPublic = true;

  if (category && VALID_CATEGORY_VALUES.includes(category as typeof VALID_CATEGORY_VALUES[number])) {
    where.category = category as typeof VALID_CATEGORY_VALUES[number];
  }

  // Search by name or description
  if (q && q.trim()) {
    const query = q.trim();
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.SkillOrderByWithRelationInput[] =
    sort === "popular"
      ? [{ usageCount: "desc" }, { createdAt: "desc" }]
      : [{ isBuiltIn: "desc" }, { createdAt: "desc" }];

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { agents: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.skill.count({ where }),
  ]);

  return jsonOk({ skills, total, page, limit });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const {
    name, description, systemPrompt, templates, citationRules,
    jurisdiction, icon, iconColor, isBuiltIn, isPublic,
    category, tags,
  } = body;

  if (!name || !systemPrompt) {
    return jsonError("Обязательные поля: name, systemPrompt", 400);
  }

  // Validate category if provided
  const resolvedCategory = category && VALID_CATEGORY_VALUES.includes(category)
    ? category
    : "CUSTOM";

  // Validate tags if provided
  const resolvedTags = Array.isArray(tags)
    ? tags.filter((t: unknown) => typeof t === "string" && (t as string).length <= 50).slice(0, 20)
    : [];

  const skill = await prisma.skill.create({
    data: {
      name,
      description: description || null,
      systemPrompt,
      templates: templates || null,
      citationRules: citationRules || null,
      jurisdiction: jurisdiction || "RU",
      icon: icon || DEFAULT_SKILL_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
      isBuiltIn: isBuiltIn ?? true,
      isPublic: isPublic ?? true,
      status: "APPROVED", // Admin-created skills are auto-approved
      category: resolvedCategory,
      tags: resolvedTags,
    },
  });

  return jsonOk(skill, 201);
}
