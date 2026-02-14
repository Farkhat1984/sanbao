import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const agents = await prisma.systemAgent.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(agents);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, systemPrompt, icon, iconColor, model, isActive, sortOrder } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: "Обязательные поля: name, systemPrompt" }, { status: 400 });
  }

  const existing = await prisma.systemAgent.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Агент с таким именем уже существует" }, { status: 409 });
  }

  const agent = await prisma.systemAgent.create({
    data: {
      name,
      description: description || null,
      systemPrompt,
      icon: icon || DEFAULT_AGENT_ICON,
      iconColor: iconColor || DEFAULT_ICON_COLOR,
      model: model || "default",
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(agent, { status: 201 });
}
