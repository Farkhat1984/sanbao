import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, jsonValidationError, serializeDates } from "@/lib/api-helpers";
import { integrationUpdateSchema } from "@/lib/validation";
import { encrypt, decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import type { WhatsAppCredentials, TelegramCredentials } from "@/types/integration";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      type: true,
      baseUrl: true,
      status: true,
      statusMessage: true,
      catalog: true,
      discoveredEntities: true,
      entityCount: true,
      lastDiscoveredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!integration) return jsonError("Интеграция не найдена", 404);

  return jsonOk(serializeDates(integration));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = integrationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  const existing = await prisma.integration.findFirst({ where: { id, userId } });
  if (!existing) return jsonError("Интеграция не найдена", 404);

  const { name, baseUrl, username, password } = parsed.data;

  // SSRF check if URL changed
  if (baseUrl && baseUrl !== existing.baseUrl) {
    const safe = await isUrlSafeAsync(baseUrl);
    if (!safe) {
      return jsonError("Недопустимый URL (доступ к внутренним сетям запрещён)", 400);
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (baseUrl !== undefined) data.baseUrl = baseUrl.replace(/\/+$/, "");
  if (username !== undefined && password !== undefined) {
    data.credentials = encrypt(Buffer.from(`${username}:${password}`).toString("base64"));
  }

  const updated = await prisma.integration.update({
    where: { id },
    data,
    select: {
      id: true, name: true, type: true, baseUrl: true, status: true,
      statusMessage: true, entityCount: true, lastDiscoveredAt: true,
      createdAt: true, updatedAt: true,
    },
  });

  return jsonOk(serializeDates(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const existing = await prisma.integration.findFirst({ where: { id, userId } });
  if (!existing) return jsonError("Интеграция не найдена", 404);

  // Clean up rk-wa instance for WhatsApp integrations
  if (existing.type === "WHATSAPP") {
    try {
      const creds = JSON.parse(decrypt(existing.credentials)) as WhatsAppCredentials;
      await fetch(`${existing.baseUrl}/api/instances/${creds.instanceId}`, {
        method: "DELETE",
        headers: { "x-api-key": creds.apiKey },
      });
    } catch {
      // Log but don't block deletion
    }
  }

  // Clean up rk-tg instance for Telegram integrations
  if (existing.type === "TELEGRAM") {
    try {
      const creds = JSON.parse(decrypt(existing.credentials)) as TelegramCredentials;
      await fetch(`${existing.baseUrl}/api/instances/${creds.instanceId}`, {
        method: "DELETE",
        headers: { "x-api-key": creds.apiKey },
      });
    } catch {
      // Log but don't block deletion
    }
  }

  await prisma.integration.delete({ where: { id } });

  return jsonOk({ success: true });
}
