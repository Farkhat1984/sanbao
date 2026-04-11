// ─── whatsapp_messages — Get recent WhatsApp messages ───

import { registerNativeTool } from "../../registry";
import { getWhatsAppIntegrationForUser, makeWhatsAppRequest, truncateResponse } from "../_helpers";
import { getSettingNumber } from "@/lib/settings";
import type { WhatsAppCredentials } from "@/types/integration";
import { decrypt } from "@/lib/crypto";

registerNativeTool({
  name: "whatsapp_messages",
  description:
    "Получает последние сообщения WhatsApp. Полезно для контекста: что писали, кто писал, о чём разговор.",
  parameters: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description: "Фильтр по номеру телефона собеседника (необязательно). Без «+», например: 77001234567",
      },
      limit: {
        type: "number",
        description: "Количество последних сообщений (по умолчанию 20, максимум 50)",
      },
      integration_name: {
        type: "string",
        description: "Название WhatsApp интеграции (если несколько)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const phone = args.phone ? String(args.phone).replace(/\D/g, "") : undefined;
    const rawLimit = args.limit != null ? Number(args.limit) : 20;
    const limit = Math.max(1, Math.min(50, rawLimit));
    const integrationName = args.integration_name as string | undefined;

    const integration = await getWhatsAppIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой WhatsApp интеграции.",
      });
    }

    try {
      // Use the instances events endpoint for recent activity
      const creds = JSON.parse(decrypt(integration.credentials)) as WhatsAppCredentials;
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      queryParams.set("types", "message_received,message_sent");

      const res = await fetch(
        `${integration.baseUrl}/api/instances/${creds.instanceId}/activity?${queryParams.toString()}`,
        {
          headers: { "x-api-key": creds.apiKey },
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка получения сообщений: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json();
      let messages = Array.isArray(data) ? data : data.activity || data.events || data.messages || [];

      // Filter by phone if specified
      if (phone && Array.isArray(messages)) {
        messages = messages.filter(
          (m: Record<string, unknown>) =>
            String(m.remoteJid || m.phone || m.from || "").includes(phone)
        );
      }

      const maxBytes = await getSettingNumber("native_http_max_response_bytes");
      const text = JSON.stringify({
        messages: messages.slice(0, limit),
        count: messages.length,
      });

      return truncateResponse(text, maxBytes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут получения сообщений WhatsApp." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка WhatsApp: ${msg}` });
    }
  },
});
