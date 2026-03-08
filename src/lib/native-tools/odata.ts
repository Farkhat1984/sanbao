import { registerNativeTool } from "./registry";
import { prisma } from "../prisma";
import { decrypt } from "../crypto";
import { isUrlSafe } from "../ssrf";
import { TOOL_RESULT_MAX_CHARS } from "../constants";

registerNativeTool({
  name: "odata_query",
  description:
    "Выполняет OData-запрос к 1С через настроенную интеграцию пользователя. Используй для получения данных из справочников, документов и регистров 1С.",
  parameters: {
    type: "object",
    properties: {
      entity: {
        type: "string",
        description: "Имя OData-сущности, например: Catalog_Контрагенты, Document_РеализацияТоваровУслуг",
      },
      filter: {
        type: "string",
        description: "OData $filter выражение, например: Date gt datetime'2026-01-01'",
      },
      select: {
        type: "string",
        description: "OData $select — список полей через запятую",
      },
      top: {
        type: "number",
        description: "Максимальное количество записей ($top). По умолчанию 20, макс 100.",
      },
      orderby: {
        type: "string",
        description: "OData $orderby выражение, например: Date desc",
      },
    },
    required: ["entity"],
  },
  async execute(args, ctx) {
    const entity = args.entity as string;
    const filter = args.filter as string | undefined;
    const select = args.select as string | undefined;
    const top = Math.min(Math.max(1, (args.top as number) || 20), 100);
    const orderby = args.orderby as string | undefined;

    // Find user's connected integration
    const integration = await prisma.integration.findFirst({
      where: {
        userId: ctx.userId,
        type: "ODATA_1C",
        status: "CONNECTED",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой интеграции 1С. Создайте интеграцию в разделе «Интеграции» и выполните обнаружение.",
      });
    }

    // SSRF check (defense in depth)
    if (!isUrlSafe(integration.baseUrl)) {
      return JSON.stringify({ error: "URL интеграции не прошёл проверку безопасности" });
    }

    try {
      const basicAuth = decrypt(integration.credentials);

      // Build OData URL
      const queryParams = new URLSearchParams({ $format: "json", $top: String(top) });
      if (filter) queryParams.set("$filter", filter);
      if (select) queryParams.set("$select", select);
      if (orderby) queryParams.set("$orderby", orderby);

      // Construct URL — append entity name to base URL
      const baseUrl = integration.baseUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/${encodeURIComponent(entity)}?${queryParams.toString()}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `HTTP ${res.status}`,
          details: errText.slice(0, 500),
        });
      }

      const data = await res.json();
      let resultStr = JSON.stringify(data, null, 2);

      // Truncate if too large
      if (resultStr.length > TOOL_RESULT_MAX_CHARS) {
        resultStr = resultStr.slice(0, TOOL_RESULT_MAX_CHARS) + "\n... (обрезано)";
      }

      return resultStr;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка запроса: ${message}` });
    }
  },
});
