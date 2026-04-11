// ─── telegram_bot_info — Get bot information ────────────

import { registerNativeTool } from "../../registry";
import { getTelegramIntegrationForUser, makeTelegramRequest } from "../_helpers";

registerNativeTool({
  name: "telegram_bot_info",
  description:
    "Возвращает информацию о Telegram боте: имя, username, описание.",
  parameters: {
    type: "object",
    properties: {
      integration_name: {
        type: "string",
        description: "Название Telegram интеграции (если несколько)",
      },
    },
    required: [],
  },
  async execute(args, ctx) {
    const integrationName = args.integration_name as string | undefined;

    const integration = await getTelegramIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой Telegram интеграции.",
      });
    }

    try {
      const res = await makeTelegramRequest(integration, "GET", "me");

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка получения информации о боте: HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json().catch(() => ({}));
      return JSON.stringify(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут получения информации о боте Telegram." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка Telegram: ${msg}` });
    }
  },
});
