import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const marketplace = searchParams.get("marketplace") === "true";

  const skills = await prisma.skill.findMany({
    where: marketplace
      ? { isPublic: true }
      : {
          OR: [
            { isBuiltIn: true },
            { userId: session.user.id },
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

  const result = skills.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor } = body;

  if (!name?.trim() || !systemPrompt?.trim()) {
    return NextResponse.json(
      { error: "Название и системный промпт обязательны" },
      { status: 400 }
    );
  }

  const skill = await prisma.skill.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      systemPrompt: systemPrompt.trim(),
      templates: templates || null,
      citationRules: citationRules?.trim() || null,
      jurisdiction: jurisdiction || "RU",
      icon: icon || DEFAULT_SKILL_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
    },
  });

  return NextResponse.json({
    ...skill,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  });
}
