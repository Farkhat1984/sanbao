// ─── whatsapp_send_media — Send media via WhatsApp ──────

import { registerNativeTool } from "../../registry";
import { getWhatsAppIntegrationForUser, makeWhatsAppRequest } from "../_helpers";

registerNativeTool({
  name: "whatsapp_send_media",
  description:
    "Отправляет медиафайл (изображение, видео, документ) в WhatsApp по URL. Файл скачивается и отправляется получателю.",
  parameters: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description: "Номер телефона получателя (международный формат без «+»). Например: 77001234567",
      },
      url: {
        type: "string",
        description: "URL медиафайла для отправки (изображение, видео, PDF и т.д.)",
      },
      caption: {
        type: "string",
        description: "Подпись к медиафайлу (необязательно)",
      },
      filename: {
        type: "string",
        description: "Имя файла (необязательно, определяется автоматически)",
      },
      integration_name: {
        type: "string",
        description: "Название WhatsApp интеграции (если несколько)",
      },
    },
    required: ["phone", "url"],
  },
  async execute(args, ctx) {
    const phone = String(args.phone).replace(/\D/g, "");
    const url = String(args.url);
    const caption = args.caption as string | undefined;
    const filename = args.filename as string | undefined;
    const integrationName = args.integration_name as string | undefined;

    if (!phone || !url) {
      return JSON.stringify({ error: "Необходимо указать phone и url." });
    }

    const integration = await getWhatsAppIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой WhatsApp интеграции.",
      });
    }

    try {
      const body: Record<string, unknown> = { phone, url };
      if (caption) body.caption = caption;
      if (filename) body.filename = filename;

      const res = await makeWhatsAppRequest(integration, "POST", "send-media", body);

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
        messageId: data.id || null,
        phone,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({ error: "Таймаут отправки медиа WhatsApp." });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка WhatsApp: ${msg}` });
    }
  },
});
