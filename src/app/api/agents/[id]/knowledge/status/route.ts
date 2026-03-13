import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["READY", "ERROR", "PUBLISHED", "NONE"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * PATCH /api/agents/[id]/knowledge/status
 * Persists the knowledge pipeline status after SSE reports completion or error.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Неверный формат запроса", 400);
  }

  const newStatus = body.status as AllowedStatus | undefined;
  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return jsonError(
      `Допустимые статусы: ${ALLOWED_STATUSES.join(", ")}`,
      400
    );
  }

  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  await prisma.agent.update({
    where: { id },
    data: { knowledgeStatus: newStatus },
  });

  return jsonOk({ success: true, status: newStatus });
}
