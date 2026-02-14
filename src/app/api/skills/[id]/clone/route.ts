import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const source = await prisma.skill.findFirst({
    where: {
      id,
      OR: [{ isBuiltIn: true }, { isPublic: true }],
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Скилл не найден" }, { status: 404 });
  }

  const clone = await prisma.skill.create({
    data: {
      userId: session.user.id,
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

  return NextResponse.json({
    ...clone,
    createdAt: clone.createdAt.toISOString(),
    updatedAt: clone.updatedAt.toISOString(),
  });
}
