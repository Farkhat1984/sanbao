import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";
import { parsePagination } from "@/lib/validation";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // builtin | public | all
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (type === "builtin") where.isBuiltIn = true;
  if (type === "public") where.isPublic = true;
  if (type === "pending") where.status = "PENDING";
  if (type === "approved") where.status = "APPROVED";
  if (type === "rejected") where.status = "REJECTED";

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { agents: true } },
      },
      orderBy: [{ isBuiltIn: "desc" }, { createdAt: "desc" }],
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
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor, isBuiltIn, isPublic } = body;

  if (!name || !systemPrompt) {
    return jsonError("Обязательные поля: name, systemPrompt", 400);
  }

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
    },
  });

  return jsonOk(skill, 201);
}
