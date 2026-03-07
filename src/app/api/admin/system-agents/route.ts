import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ICON_COLOR, DEFAULT_AGENT_ICON } from "@/lib/constants";
import { parsePagination } from "@/lib/validation";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const where = { isSystem: true as const };

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        skills: { include: { skill: { select: { id: true, name: true, icon: true, iconColor: true } } } },
        mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true, status: true } } } },
        tools: { include: { tool: { select: { id: true, name: true, icon: true, iconColor: true } } } },
      },
      skip,
      take: limit,
    }),
    prisma.agent.count({ where }),
  ]);

  // Map to compatible format for admin page
  return jsonOk({
    agents: agents.map((a) => ({
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
      skills: a.skills.map((s) => s.skill),
      mcpServers: a.mcpServers.map((m) => m.mcpServer),
      tools: a.tools.map((t) => t.tool),
    })),
    total,
    page,
    limit,
  });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, description, systemPrompt, icon, iconColor, model, isActive, sortOrder, starterPrompts, skillIds, mcpServerIds, toolIds } = body;

  if (!name || !systemPrompt) {
    return jsonError("Обязательные поля: name, systemPrompt", 400);
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

  // Create associations
  if (Array.isArray(skillIds) && skillIds.length > 0) {
    await prisma.agentSkill.createMany({ data: skillIds.map((skillId: string) => ({ agentId: agent.id, skillId })) });
  }
  if (Array.isArray(mcpServerIds) && mcpServerIds.length > 0) {
    await prisma.agentMcpServer.createMany({ data: mcpServerIds.map((mcpServerId: string) => ({ agentId: agent.id, mcpServerId })) });
  }
  if (Array.isArray(toolIds) && toolIds.length > 0) {
    await prisma.agentTool.createMany({ data: toolIds.map((toolId: string) => ({ agentId: agent.id, toolId })) });
  }
  return jsonOk({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.instructions,
    icon: agent.icon,
    iconColor: agent.iconColor,
    model: agent.model,
    isActive: agent.status === "APPROVED",
    sortOrder: agent.sortOrder,
  }, 201);
}
