// ─── telegram_chats — Get recent Telegram chats ─────────

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest, truncateResponse } from "../_helpers";
import { getSettingNumber } from "@/lib/settings";

registerNativeTool({
  name: "telegram_chats",
  description:
    "Получает список недавних чатов Telegram бота.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Максимальное количество чатов (по умолчанию 50, максимум 100)",
      },
      integration_name: {
        type: "string",
        description: "Название Telegram интеграции (если несколько)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const rawLimit = args.limit != null ? Number(args.limit) : 50;
    const limit = Math.max(1, Math.min(100, rawLimit));
    const integrationName = args.integration_name as string | undefined;

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции.",
      });
    }

    try {
      const res = await makeTelegramRequest(
        integration,
        "GET",
        `chats?limit=${limit}`
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка получения чатов: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json();
      const maxBytes = await getSettingNumber("native_http_max_response_bytes");
      const text = JSON.stringify({
        chats: data.chats || data || [],
        total: data.total || 0,
      });

      return truncateResponse(text, maxBytes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут получения чатов Telegram." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка Telegram: ${msg}` });
    }
  },
});
