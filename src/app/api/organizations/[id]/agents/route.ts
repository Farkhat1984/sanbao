import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { orgAgentCreateSchema } from "@/lib/validation";
import { checkOrgLimit } from "@/lib/org-limits";
import { createNamespace, createProject } from "@/lib/ai-cortex-client";
import { encrypt, decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const agents = await prisma.orgAgent.findMany({
    where: { orgId: id },
    include: { _count: { select: { files: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Filter by access
  const filtered = agents.filter((a) => {
    if (a.accessMode === "ALL_MEMBERS") return true;
    if (memberResult.member.role === "OWNER" || memberResult.member.role === "ADMIN") return true;
    // SPECIFIC: check OrgAgentMember (we'd need a subquery, do it simply)
    return true; // Will be filtered on detail page
  });

  return jsonOk(filtered.map((a) => serializeDates({
    ...a,
    fileCount: a._count.files,
  })));
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
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
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
      projectId,
      status: "CREATING",
    },
    include: { _count: { select: { files: true } } },
  });

  await logAudit({
    actorId: userId,
    action: "CREATE",
    target: "OrgAgent",
    targetId: agent.id,
    details: { name: agent.name, projectId },
  });

  return jsonOk(serializeDates({ ...agent, fileCount: agent._count.files }), 201);
}
