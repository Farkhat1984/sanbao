import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // builtin | public | all

  const where: Record<string, unknown> = {};
  if (type === "builtin") where.isBuiltIn = true;
  if (type === "public") where.isPublic = true;
  if (type === "pending") where.status = "PENDING";
  if (type === "approved") where.status = "APPROVED";
  if (type === "rejected") where.status = "REJECTED";

  const skills = await prisma.skill.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { agents: true } },
    },
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json(skills);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, systemPrompt, templates, citationRules, jurisdiction, icon, iconColor, isBuiltIn, isPublic } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: "Обязательные поля: name, systemPrompt" }, { status: 400 });
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

  return NextResponse.json(skill, { status: 201 });
}
