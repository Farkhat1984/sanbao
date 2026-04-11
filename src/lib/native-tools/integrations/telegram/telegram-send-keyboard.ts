// ─── telegram_send_keyboard — Send message with inline keyboard ───

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest } from "../_helpers";

registerNativeTool({
  name: "telegram_send_keyboard",
  description:
    "Отправляет сообщение с inline-кнопками в Telegram. Полезно для интерактивных меню и быстрых ответов.",
  parameters: {
    type: "object",
    properties: {
      chatId: {
        type: "string",
        description: "Числовой ID чата Telegram",
      },
      message: {
        type: "string",
        description: "Текст сообщения",
      },
      buttons: {
        type: "array",
        description: "Массив кнопок. Каждая кнопка: { text, callbackData?, url? }",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "Текст кнопки" },
            callbackData: { type: "string", description: "Данные для callback (необязательно)" },
            url: { type: "string", description: "URL для открытия (необязательно)" },
          },
          required: ["text"],
        },
      },
      integration_name: {
        type: "string",
        description: "Название Telegram интеграции (если несколько)",
      },
    },
    required: ["chatId", "message", "buttons"],
  },
  async execute(args, ctx) {
    const chatId = String(args.chatId);
    const message = String(args.message);
    const buttons = args.buttons as Array<{ text: string; callbackData?: string; url?: string }>;
    const integrationName = args.integration_name as string | undefined;

    if (!chatId || !message || !Array.isArray(buttons) || buttons.length === 0) {
      return JSON.stringify({ error: "Необходимо указать chatId, message и buttons (непустой массив)." });
    }

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции.",
      });
    }

    try {
      const res = await makeTelegramRequest(integration, "POST", "send-keyboard", {
        chatId,
        text: message,
        buttons,
      });

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
