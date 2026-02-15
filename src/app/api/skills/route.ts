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

  return jsonOk(skills.map(serializeDates));
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
