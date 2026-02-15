import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const agents = await prisma.agent.findMany({
    where: { isSystem: true },
    orderBy: { sortOrder: "asc" },
    include: {
      tools: { include: { tool: { select: { id: true, name: true } } } },
      plugins: { include: { plugin: { select: { id: true, name: true } } } },
    },
  });

  // Map to compatible format for admin page
  return NextResponse.json(agents.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    systemPrompt: a.instructions,
    icon: a.icon,
    iconColor: a.iconColor,
    model: a.model,
    isActive: a.status === "APPROVED",
    sortOrder: a.sortOrder,
    starterPrompts: a.starterPrompts || [],
    tools: a.tools.map((t) => t.tool),
    plugins: a.plugins.map((p) => p.plugin),
  })));
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, systemPrompt, icon, iconColor, model, isActive, sortOrder, starterPrompts } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: "Обязательные поля: name, systemPrompt" }, { status: 400 });
  }

  const agent = await prisma.agent.create({
    data: {
      name,
      description: description || null,
      instructions: systemPrompt,
      icon: icon || DEFAULT_AGENT_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
      model: model || "default",
      status: isActive === false ? "PENDING" : "APPROVED",
      isSystem: true,
      userId: null,
      sortOrder: sortOrder ?? 0,
      starterPrompts: Array.isArray(starterPrompts) ? starterPrompts.filter((s: string) => s.trim()) : [],
    },
  });

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.instructions,
    icon: agent.icon,
    iconColor: agent.iconColor,
    model: agent.model,
    isActive: agent.status === "APPROVED",
    sortOrder: agent.sortOrder,
  }, { status: 201 });
}
