import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { getProject, cancelJob } from "@/lib/ai-cortex-client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан", 400);

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org?.nsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(org.nsApiKey);

  try {
    const project = await getProject(nsApiKey, agent.projectId);
    if (project.current_job_id) {
      await cancelJob(nsApiKey, project.current_job_id);
    }
  } catch {
    // Best-effort cancel
  }

  await prisma.orgAgent.update({
    where: { id: agentId },
    data: { status: "CREATING" },
  });

  return jsonOk({ success: true });
}
