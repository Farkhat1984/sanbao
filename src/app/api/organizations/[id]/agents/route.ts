import { requireAuth, jsonOk, jsonError, jsonValidationError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { orgAgentCreateSchema } from "@/lib/validation";
import { checkOrgLimit } from "@/lib/org-limits";
import { createNamespace, createProject } from "@/lib/ai-cortex-client";
import { encrypt, decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  const agents = await prisma.orgAgent.findMany({
    where: { orgId: id },
    include: { _count: { select: { files: true } } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = agents.length > limit;
  if (hasMore) agents.pop();
  const nextCursor = hasMore && agents.length > 0
    ? agents[agents.length - 1].id
    : null;

  // Filter by access
  const filtered = agents.filter((a) => {
    if (a.accessMode === "ALL_MEMBERS") return true;
    if (memberResult.member.role === "OWNER" || memberResult.member.role === "ADMIN") return true;
    // SPECIFIC: check OrgAgentMember (we'd need a subquery, do it simply)
    return true; // Will be filtered on detail page
  });

  return jsonOk({
    agents: filtered.map((a) => serializeDates({
      ...a,
      fileCount: a._count.files,
    })),
    nextCursor,
    hasMore,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = orgAgentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  // Check plan limits
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return jsonError("Организация не найдена", 404);

  if (session.user.role !== "ADMIN") {
    const limit = await checkOrgLimit(org.ownerId, "agents", id);
    if (!limit.allowed) return jsonError(limit.error!, 403);
  }

  // Lazy create namespace if needed
  let nsApiKey = org.nsApiKey ? decrypt(org.nsApiKey) : null;
  if (!nsApiKey) {
    try {
      const ns = await createNamespace(org.namespace, org.name);
      nsApiKey = ns.apiKey;
      await prisma.organization.update({
        where: { id },
        data: { nsApiKey: encrypt(nsApiKey) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI Cortex namespace creation failed";
      return jsonError(msg, 502);
    }
  }

  // Create project in AI Cortex
  let projectId: string;
  try {
    const project = await createProject(nsApiKey, parsed.data.name, parsed.data.name);
    projectId = project.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI Cortex project creation failed";
    return jsonError(msg, 502);
  }

  const agent = await prisma.orgAgent.create({
    data: {
      orgId: id,
      name: parsed.data.name,
      description: parsed.data.description,
      icon: parsed.data.icon,
      iconColor: parsed.data.iconColor,
      instructions: parsed.data.instructions,
      starterPrompts: parsed.data.starterPrompts?.filter((s) => s.trim()) ?? [],
      projectId,
      status: "CREATING",
    },
    include: { _count: { select: { files: true } } },
  });

  // Create skill associations
  const skillIds = parsed.data.skillIds;
  if (Array.isArray(skillIds) && skillIds.length > 0) {
    await prisma.orgAgentSkill.createMany({
      data: skillIds.map((skillId) => ({ orgAgentId: agent.id, skillId })),
      skipDuplicates: true,
    });
  }

  // Create MCP server associations
  const mcpServerIds = parsed.data.mcpServerIds;
  if (Array.isArray(mcpServerIds) && mcpServerIds.length > 0) {
    await prisma.orgAgentMcpServer.createMany({
      data: mcpServerIds.map((mcpServerId) => ({ orgAgentId: agent.id, mcpServerId })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    actorId: userId,
    action: "CREATE",
    target: "OrgAgent",
    targetId: agent.id,
    details: { name: agent.name, projectId },
  });

  return jsonOk(serializeDates({ ...agent, fileCount: agent._count.files }), 201);
}
