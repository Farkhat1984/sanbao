// ─── telegram_send_media — Send media via Telegram ──────

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest } from "../_helpers";

registerNativeTool({
  name: "telegram_send_media",
  description:
    "Отправляет медиафайл (фото, документ, голосовое, видео) в Telegram по URL.",
  parameters: {
    type: "object",
    properties: {
      chatId: {
        type: "string",
        description: "Числовой ID чата Telegram",
      },
      url: {
        type: "string",
        description: "URL медиафайла для отправки",
      },
      type: {
        type: "string",
        description: "Тип медиа: photo, document, voice, video (по умолчанию document)",
      },
      caption: {
        type: "string",
        description: "Подпись к медиафайлу (необязательно)",
      },
      integration_name: {
        type: "string",
        description: "Название Telegram интеграции (если несколько)",
      },
    },
    required: ["chatId", "url"],
  },
  async execute(args, ctx) {
    const chatId = String(args.chatId);
    const url = String(args.url);
    const mediaType = (args.type as string) || "document";
    const caption = args.caption as string | undefined;
    const integrationName = args.integration_name as string | undefined;

    if (!chatId || !url) {
      return JSON.stringify({ error: "Необходимо указать chatId и url." });
    }

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции.",
      });
    }

    try {
      const body: Record<string, unknown> = { chatId, url, type: mediaType };
      if (caption) body.caption = caption;

      const res = await makeTelegramRequest(integration, "POST", "send-media", body);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка отправки медиа: HTTP ${res.status}`,
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
        return JSON.stringify({ error: "Таймаут отправки медиа Telegram." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка Telegram: ${msg}` });
    }
  },
});
