import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const source = await prisma.skill.findFirst({
    where: {
      id,
      OR: [{ isBuiltIn: true }, { isPublic: true }],
    },
  });

  if (!source) {
    return jsonError("Скилл не найден", 404);
  }

  const clone = await prisma.skill.create({
    data: {
      userId: userId,
      name: `${source.name} (копия)`,
      description: source.description,
      systemPrompt: source.systemPrompt,
      templates: source.templates ?? undefined,
      citationRules: source.citationRules,
      jurisdiction: source.jurisdiction,
      icon: source.icon,
      iconColor: source.iconColor,
      isBuiltIn: false,
      isPublic: false,
    },
  });

  return jsonOk({
    ...clone,
    createdAt: clone.createdAt.toISOString(),
    updatedAt: clone.updatedAt.toISOString(),
  });
}
