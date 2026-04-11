// ─── whatsapp_send — Send text message via WhatsApp ─────

import { registerNativeTool } from "../../registry";
import { getWhatsAppIntegrationForUser, makeWhatsAppRequest } from "../_helpers";

registerNativeTool({
  name: "whatsapp_send",
  description:
    "Отправляет текстовое сообщение в WhatsApp. Укажите номер телефона в международном формате (без +) и текст сообщения.",
  parameters: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description:
          "Номер телефона получателя в международном формате без «+». Например: 77001234567",
      },
      message: {
        type: "string",
        description: "Текст сообщения",
      },
      integration_name: {
        type: "string",
        description:
          "Название WhatsApp интеграции (если у пользователя несколько). Если не указано — используется первая подключённая.",
      },
    },
    required: ["phone", "message"],
  },
  async execute(args, ctx) {
    const phone = String(args.phone).replace(/\D/g, "");
    const message = String(args.message);
    const integrationName = args.integration_name as string | undefined;

    if (!phone || !message) {
      return JSON.stringify({ error: "Необходимо указать phone и message." });
    }

    const integration = await getWhatsAppIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой WhatsApp интеграции. Попросите пользователя настроить интеграцию в разделе «Интеграции».",
      });
    }

    try {
      const res = await makeWhatsAppRequest(integration, "POST", "send", { phone, message });

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
        messageId: data.id || null,
        phone,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут отправки сообщения WhatsApp." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка WhatsApp: ${msg}` });
    }
  },
});
