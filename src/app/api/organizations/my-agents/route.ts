import { requireAuth, jsonOk, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  // Get all orgs where user is a member
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    select: { orgId: true, role: true },
  });

  if (memberships.length === 0) return jsonOk({ agents: [], multiAgents: [] });

  const orgIds = memberships.map((m) => m.orgId);
  const roleMap = new Map(memberships.map((m) => [m.orgId, m.role]));

  // Get all published agents from those orgs
  const agents = await prisma.orgAgent.findMany({
    where: {
      orgId: { in: orgIds },
      status: "PUBLISHED",
    },
    include: {
      org: { select: { id: true, name: true, slug: true, swarmEnabled: true } },
      mcpServer: { select: { id: true, name: true, url: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Filter by access mode
  const filtered = [];
  for (const agent of agents) {
    const role = roleMap.get(agent.orgId);
    if (!role) continue;

    if (agent.accessMode === "ALL_MEMBERS") {
      filtered.push(agent);
    } else if (role === "OWNER" || role === "ADMIN") {
      filtered.push(agent);
    } else {
      // Check OrgAgentMember for SPECIFIC access
      const access = await prisma.orgAgentMember.findUnique({
        where: { orgAgentId_userId: { orgAgentId: agent.id, userId } },
      });
      if (access) filtered.push(agent);
    }
  }

  const allMultiAgents = await prisma.multiAgent.findMany({
    where: { orgId: { in: orgIds } },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      members: { select: { agentType: true, agentId: true } },
      userAccess: { select: { userId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Filter multiagents by access mode
  const filteredMultiAgents = [];
  for (const ma of allMultiAgents) {
    const role = roleMap.get(ma.orgId);
    if (!role) continue;

    if (ma.accessMode === "ALL_MEMBERS") {
      filteredMultiAgents.push(ma);
    } else if (role === "OWNER" || role === "ADMIN") {
      filteredMultiAgents.push(ma);
    } else {
      const hasAccess = ma.userAccess.some((ua) => ua.userId === userId);
      if (hasAccess) filteredMultiAgents.push(ma);
    }
  }

  return jsonOk({
    agents: filtered.map((a) => serializeDates({
      id: a.id,
      orgId: a.orgId,
      orgName: a.org.name,
      orgSlug: a.org.slug,
      name: a.name,
      description: a.description,
      status: a.status,
      mcpServer: a.mcpServer,
      swarmEnabled: a.org.swarmEnabled,
    })),
    multiAgents: filteredMultiAgents.map((ma) => serializeDates({
      id: ma.id,
      orgId: ma.orgId,
      orgName: ma.org.name,
      orgSlug: ma.org.slug,
      name: ma.name,
      description: ma.description,
      icon: ma.icon,
      iconColor: ma.iconColor,
      memberCount: ma.members.length,
    })),
  });
}
