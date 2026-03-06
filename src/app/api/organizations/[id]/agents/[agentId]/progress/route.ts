import { requireAuth, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { decrypt } from "@/lib/crypto";
import { getProjectProgress } from "@/lib/ai-cortex-client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!agent?.projectId) return jsonError("Агент не найден", 404);

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org?.nsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(org.nsApiKey);

  try {
    const response = await getProjectProgress(nsApiKey, agent.projectId);

    // Proxy the SSE stream
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка получения прогресса";
    return jsonError(msg, 502);
  }
}
