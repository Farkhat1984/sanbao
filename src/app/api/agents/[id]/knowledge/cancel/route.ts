import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getProject, cancelJob } from "@/lib/ai-cortex-client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId },
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан", 400);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cortexNsApiKey: true },
  });
  if (!user?.cortexNsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(user.cortexNsApiKey);

  try {
    const project = await getProject(nsApiKey, agent.projectId);
    if (project.current_job_id) {
      await cancelJob(nsApiKey, project.current_job_id);
    }
  } catch {
    // Best-effort cancel — job may have already finished
  }

  await prisma.agent.update({
    where: { id },
    data: { knowledgeStatus: "NONE" },
  });

  return jsonOk({ success: true });
}
