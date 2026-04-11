// ─── whatsapp_contacts — Get WhatsApp contacts ─────────

import { registerNativeTool } from "../../registry";
import { getWhatsAppIntegrationForUser, makeWhatsAppRequest, truncateResponse } from "../_helpers";
import { getSettingNumber } from "@/lib/settings";

registerNativeTool({
  name: "whatsapp_contacts",
  description:
    "Получает список контактов WhatsApp. Можно искать по имени или номеру.",
  parameters: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "Поиск по имени или номеру контакта (необязательно)",
      },
      limit: {
        type: "number",
        description: "Максимальное количество контактов (по умолчанию 50, максимум 100)",
      },
      integration_name: {
        type: "string",
        description: "Название WhatsApp интеграции (если несколько)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const search = args.search as string | undefined;
    const rawLimit = args.limit != null ? Number(args.limit) : 50;
    const limit = Math.max(1, Math.min(100, rawLimit));
    const integrationName = args.integration_name as string | undefined;

    const integration = await getWhatsAppIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой WhatsApp интеграции.",
      });
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      if (search) queryParams.set("search", search);

      const res = await makeWhatsAppRequest(
        integration,
        "GET",
        `contacts/db?${queryParams.toString()}`
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка получения контактов: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json();
      const maxBytes = await getSettingNumber("native_http_max_response_bytes");
      const text = JSON.stringify({
        contacts: data.contacts || [],
        total: data.total || 0,
      });

      return truncateResponse(text, maxBytes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут получения контактов WhatsApp." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка WhatsApp: ${msg}` });
    }
  },
});
