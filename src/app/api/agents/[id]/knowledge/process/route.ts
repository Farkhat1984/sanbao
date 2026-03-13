import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { processProject, reprocessProject } from "@/lib/ai-cortex-client";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id, userId },
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан. Сначала загрузите файлы.", 400);

  // Get user's cortex API key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cortexNsApiKey: true },
  });
  if (!user?.cortexNsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(user.cortexNsApiKey);

  try {
    await processProject(nsApiKey, agent.projectId);
  } catch (err) {
    // If project is already processed (ready/published), use reprocess instead
    const isStatusError = err instanceof Error && err.message.includes("Cannot process project in status");
    if (isStatusError) {
      try {
        await reprocessProject(nsApiKey, agent.projectId);
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : "Ошибка обработки";
        await prisma.agent.update({ where: { id }, data: { knowledgeStatus: "ERROR" } });
        return jsonError(msg, 502);
      }
    } else {
      const msg = err instanceof Error ? err.message : "Ошибка обработки";
      await prisma.agent.update({ where: { id }, data: { knowledgeStatus: "ERROR" } });
      return jsonError(msg, 502);
    }
  }

  await prisma.agent.update({
    where: { id },
    data: { knowledgeStatus: "PROCESSING" },
  });

  await logAudit({
    actorId: userId,
    action: "PROCESS_KNOWLEDGE",
    target: "Agent",
    targetId: id,
  });

  return jsonOk({ success: true, status: "PROCESSING" });
}
