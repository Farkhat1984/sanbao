import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import type { WhatsAppCredentials } from "@/types/integration";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId, type: "WHATSAPP" },
  });
  if (!integration) return jsonError("WhatsApp интеграция не найдена", 404);

  let creds: WhatsAppCredentials;
  try {
    creds = JSON.parse(decrypt(integration.credentials)) as WhatsAppCredentials;
  } catch {
    return jsonError("Ошибка дешифровки учётных данных", 500);
  }

  const baseUrl = integration.baseUrl;

  // Fetch QR and status in parallel
  const [qrRes, statusRes] = await Promise.all([
    fetch(`${baseUrl}/api/instances/${creds.instanceId}/qr`, {
      headers: { "x-api-key": creds.apiKey },
    }).catch(() => null),
    fetch(`${baseUrl}/api/instances/${creds.instanceId}/status`, {
      headers: { "x-api-key": creds.apiKey },
    }).catch(() => null),
  ]);

  let qrCode: string | null = null;
  if (qrRes && qrRes.ok) {
    const qrData = await qrRes.json().catch(() => null);
    qrCode = qrData?.qrCode || null;
  }

  let ready = false;
  let status = "connecting";
  if (statusRes && statusRes.ok) {
    const statusData = await statusRes.json().catch(() => null);
    if (statusData) {
      ready = statusData.ready === true;
      status = statusData.status || "connecting";
    }
  }

  // Auto-update integration status when connected
  if (ready && integration.status !== "CONNECTED") {
    await prisma.integration.update({
      where: { id },
      data: { status: "CONNECTED", statusMessage: null },
    });
  }

  // If disconnected/error and was previously connected, update status
  if (!ready && status === "close" && integration.status === "CONNECTED") {
    await prisma.integration.update({
      where: { id },
      data: { status: "ERROR", statusMessage: "WhatsApp отключён" },
    });
  }

  return jsonOk({ qrCode, ready, status });
}
