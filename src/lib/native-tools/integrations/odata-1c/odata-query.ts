// ─── odata_query — Execute OData queries against 1C ─────

import { registerNativeTool } from "../../registry";
import {
  getIntegrationForUser,
  makeAuthenticatedODataRequest,
  truncateResponse,
} from "../_helpers";
import { getSettingNumber } from "@/lib/settings";

/** Build OData query URL with standard query options */
function buildODataUrl(
  entity: string,
  options: {
    filter?: string;
    top?: number;
    select?: string;
    orderby?: string;
    skip?: number;
    expand?: string;
  }
): string {
  const params = new URLSearchParams();
  params.set("$format", "json");

  if (options.filter) params.set("$filter", options.filter);
  if (options.top != null) params.set("$top", String(options.top));
  if (options.select) params.set("$select", options.select);
  if (options.orderby) params.set("$orderby", options.orderby);
  if (options.skip != null) params.set("$skip", String(options.skip));
  if (options.expand) params.set("$expand", options.expand);

  return `${entity}?${params.toString()}`;
}

registerNativeTool({
  name: "odata_query",
  description:
    'Выполняет OData-запрос к базе 1С. Получает данные из справочников, документов, регистров. Используй после odata_catalog для определения доступных сущностей. Примеры entity: "Catalog_Контрагенты", "Document_РеализацияТоваровУслуг".',
  parameters: {
    type: "object",
    properties: {
      entity: {
        type: "string",
        description:
          'OData-имя сущности (полное, с префиксом). Например: "Catalog_Контрагенты", "Document_ПоступлениеТоваровУслуг"',
      },
      filter: {
        type: "string",
        description:
          "OData $filter выражение. Примеры: \"Description eq 'ТОО Астана'\", \"Date ge datetime'2024-01-01'\"",
      },
      top: {
        type: "number",
        description: "Максимальное количество записей ($top). По умолчанию 20, максимум 100.",
      },
      select: {
        type: "string",
        description:
          "Список полей через запятую ($select). Пример: \"Ref_Key,Description,Code\"",
      },
      orderby: {
        type: "string",
        description:
          "Сортировка ($orderby). Пример: \"Date desc\", \"Description asc\"",
      },
      expand: {
        type: "string",
        description:
          "Связанные сущности для загрузки ($expand). Пример: \"Контрагент\"",
      },
      skip: {
        type: "number",
        description: "Пропустить N записей ($skip). Для пагинации.",
      },
      integration_name: {
        type: "string",
        description:
          "Название интеграции (если у пользователя несколько). Если не указано — используется первая подключённая.",
      },
    },
    required: ["entity"],
  },
  async execute(args, ctx) {
    const entity = args.entity as string;
    const filter = args.filter as string | undefined;
    const select = args.select as string | undefined;
    const orderby = args.orderby as string | undefined;
    const expand = args.expand as string | undefined;
    const skip = args.skip != null ? Number(args.skip) : undefined;
    const integrationName = args.integration_name as string | undefined;

    // Clamp top to [1, 100], default 20
    const rawTop = args.top != null ? Number(args.top) : 20;
    const top = Math.max(1, Math.min(100, rawTop));

    const integration = await getIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой интеграции 1С. Попросите пользователя настроить интеграцию в разделе настроек.",
      });
    }

    const path = buildODataUrl(entity, { filter, top, select, orderby, skip, expand });
    const ODATA_TIMEOUT = 30_000;

    try {
      const res = await makeAuthenticatedODataRequest(integration, path, ODATA_TIMEOUT);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return JSON.stringify({
          error: `Ошибка OData: HTTP ${res.status} ${res.statusText}`,
          details: errorText.slice(0, 1000),
          entity,
        });
      }

      const text = await res.text();
      const maxBytes = await getSettingNumber("native_http_max_response_bytes");
      const truncated = truncateResponse(text, maxBytes);

      // Try to parse JSON to extract value array and metadata
      try {
        const json = JSON.parse(truncated);
        const values = json.value ?? json.d?.results ?? json.d;

        return JSON.stringify({
          integration: integration.name,
          entity,
          count: Array.isArray(values) ? values.length : 1,
          data: values,
        });
      } catch {
        // Could not parse — return raw (already truncated)
        return JSON.stringify({
          integration: integration.name,
          entity,
          raw: truncated,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return JSON.stringify({
          error: `Таймаут запроса к 1С (${ODATA_TIMEOUT}мс). Попробуйте уточнить фильтр или уменьшить top.`,
          entity,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `Ошибка запроса к 1С: ${msg}`, entity });
    }
  },
});
