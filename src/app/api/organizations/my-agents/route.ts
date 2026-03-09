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

  if (memberships.length === 0) return jsonOk([]);

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

  return jsonOk(filtered.map((a) => serializeDates({
    id: a.id,
    orgId: a.orgId,
    orgName: a.org.name,
    orgSlug: a.org.slug,
    name: a.name,
    description: a.description,
    status: a.status,
    mcpServer: a.mcpServer,
    swarmEnabled: a.org.swarmEnabled,
  })));
}
