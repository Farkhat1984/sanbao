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

    // Inject keepalive comments every 15s to prevent Cloudflare 524 timeout.
    // Cloudflare kills connections with no data for 100s.
    // The analyze phase can take 2+ minutes with no progress events.
    const upstream = response.body;
    if (!upstream) return jsonError("Нет данных", 502);

    const reader = upstream.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

        const sendKeepalive = () => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            // Stream already closed
          }
        };

        // Start keepalive timer
        keepaliveTimer = setInterval(sendKeepalive, 15_000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch {
          controller.close();
        } finally {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
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
