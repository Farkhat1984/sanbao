// ─── telegram_send — Send text message via Telegram ─────

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest } from "../_helpers";

registerNativeTool({
  name: "telegram_send",
  description:
    "Отправляет текстовое сообщение в Telegram. Укажите chatId (числовой ID чата) и текст сообщения.",
  parameters: {
    type: "object",
    properties: {
      chatId: {
        type: "string",
        description: "Числовой ID чата Telegram (можно получить из telegram_chats или telegram_messages)",
      },
      message: {
        type: "string",
        description: "Текст сообщения",
      },
      parseMode: {
        type: "string",
        description: "Режим парсинга текста: HTML, Markdown или MarkdownV2 (необязательно)",
      },
      integration_name: {
        type: "string",
        description:
          "Название Telegram интеграции (если у пользователя несколько). Если не указано — используется первая подключённая.",
      },
    },
    required: ["chatId", "message"],
  },
  async execute(args, ctx) {
    const chatId = String(args.chatId);
    const message = String(args.message);
    const parseMode = args.parseMode as string | undefined;
    const integrationName = args.integration_name as string | undefined;

    if (!chatId || !message) {
      return JSON.stringify({ error: "Необходимо указать chatId и message." });
    }

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции. Попросите пользователя настроить интеграцию в разделе «Интеграции».",
      });
    }

    try {
      const body: Record<string, unknown> = { chatId, text: message };
      if (parseMode) body.parseMode = parseMode;

      const res = await makeTelegramRequest(integration, "POST", "send", body);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка отправки: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json().catch(() => ({}));
      return JSON.stringify({
        success: true,
        messageId: data.messageId || data.id || null,
        chatId,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут отправки сообщения Telegram." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка Telegram: ${msg}` });
    }
  },
});
