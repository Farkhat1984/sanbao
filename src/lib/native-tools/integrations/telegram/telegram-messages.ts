// ─── telegram_messages — Get recent Telegram messages ───

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest, truncateResponse } from "../_helpers";
import { getSettingNumber } from "@/lib/settings";

registerNativeTool({
  name: "telegram_messages",
  description:
    "Получает последние сообщения Telegram бота. Полезно для контекста: что писали, кто писал.",
  parameters: {
    type: "object",
    properties: {
      chatId: {
        type: "string",
        description: "Фильтр по ID чата (необязательно)",
      },
      limit: {
        type: "number",
        description: "Количество последних сообщений (по умолчанию 20, максимум 50)",
      },
      integration_name: {
        type: "string",
        description: "Название Telegram интеграции (если несколько)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const chatId = args.chatId ? String(args.chatId) : undefined;
    const rawLimit = args.limit != null ? Number(args.limit) : 20;
    const limit = Math.max(1, Math.min(50, rawLimit));
    const integrationName = args.integration_name as string | undefined;

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции.",
      });
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      if (chatId) queryParams.set("chatId", chatId);

      const res = await makeTelegramRequest(
        integration,
        "GET",
        `messages?${queryParams.toString()}`
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка получения сообщений: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json();
      const messages = Array.isArray(data) ? data : data.messages || [];

      const maxBytes = await getSettingNumber("native_http_max_response_bytes");
      const text = JSON.stringify({
        messages: messages.slice(0, limit),
        count: messages.length,
      });

      return truncateResponse(text, maxBytes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут получения сообщений Telegram." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка Telegram: ${msg}` });
    }
  },
});
