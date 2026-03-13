import { requireAuth, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getProjectProgress } from "@/lib/ai-cortex-client";

export async function GET(
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
  if (!agent?.projectId) return jsonError("Агент не найден", 404);

  // Get user's cortex API key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cortexNsApiKey: true },
  });
  if (!user?.cortexNsApiKey) return jsonError("Namespace не настроен", 400);

  const nsApiKey = decrypt(user.cortexNsApiKey);

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
