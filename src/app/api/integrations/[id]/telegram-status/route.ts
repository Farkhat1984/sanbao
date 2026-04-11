import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import type { TelegramCredentials } from "@/types/integration";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId, type: "TELEGRAM" },
  });
  if (!integration) return jsonError("Telegram интеграция не найдена", 404);

  let creds: TelegramCredentials;
  try {
    creds = JSON.parse(decrypt(integration.credentials)) as TelegramCredentials;
  } catch {
    return jsonError("Ошибка дешифровки учётных данных", 500);
  }

  const baseUrl = integration.baseUrl;

  // Fetch bot status from rk-tg
  let ready = false;
  let status = "connecting";
  let bot: { username?: string; firstName?: string } | null = null;

  try {
    const statusRes = await fetch(
      `${baseUrl}/api/instances/${creds.instanceId}/status`,
      { headers: { "x-api-key": creds.apiKey } }
    );

    if (statusRes.ok) {
      const statusData = await statusRes.json().catch(() => null);
      if (statusData) {
        ready = statusData.ready === true;
        status = statusData.status || "connecting";
        bot = statusData.bot || null;
      }
    }
  } catch {
    // Service unavailable — report as error
    status = "error";
  }

  // Auto-update integration status when connected
  if (ready && integration.status !== "CONNECTED") {
    await prisma.integration.update({
      where: { id },
      data: { status: "CONNECTED", statusMessage: null },
    });
  }

  // If disconnected/error and was previously connected, update status
  if (!ready && (status === "error" || status === "stopped") && integration.status === "CONNECTED") {
    await prisma.integration.update({
      where: { id },
      data: { status: "ERROR", statusMessage: "Telegram бот отключён" },
    });
  }

  return jsonOk({ ready, bot, status });
}
