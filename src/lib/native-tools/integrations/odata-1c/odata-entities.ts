// ─── odata_entities — List available OData entity sets ──

import { registerNativeTool } from "../../registry";
import { getIntegrationForUser } from "../_helpers";
import { parseHierarchicalCatalog } from "@/lib/odata-catalog";

registerNativeTool({
  name: "odata_entities",
  description:
    "Возвращает список всех доступных OData-сущностей из базы 1С. Быстрая справка — показывает типы и количество сущностей без деталей. Для подробностей по категории используй odata_catalog.",
  parameters: {
    type: "object",
    properties: {
      integration_name: {
        type: "string",
        description:
          "Название интеграции (если у пользователя несколько). Если не указано — используется первая подключённая.",
      },
    },
  },
  async execute(args, ctx) {
    const integrationName = args.integration_name as string | undefined;

    const integration = await getIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой интеграции 1С. Попросите пользователя настроить интеграцию в разделе настроек.",
      });
    }

    // Use discoveredEntities (prefix -> count map) for a quick summary
    const discovered = integration.discoveredEntities as Record<string, number> | null;
    if (discovered && Object.keys(discovered).length > 0) {
      const result: {
        integration: string;
        totalEntities: number;
        byType: Record<string, number>;
        sections?: string[];
      } = {
        integration: integration.name,
        totalEntities: integration.entityCount,
        byType: discovered,
      };

      // Also include section slugs if catalog exists
      if (integration.catalog) {
        const catalog = parseHierarchicalCatalog(integration.catalog);
        if (catalog) {
          result.sections = Object.keys(catalog.sections);
        }
      }

      return JSON.stringify(result);
    }

    // Fallback: no discovered entities stored
    if (!integration.catalog) {
      return JSON.stringify({
        error: "Каталог ещё не сформирован. Необходимо запустить обнаружение сущностей для интеграции.",
      });
    }

    const catalog = parseHierarchicalCatalog(integration.catalog);
    if (!catalog) {
      return JSON.stringify({
        integration: integration.name,
        totalEntities: integration.entityCount,
        message: "Каталог в устаревшем формате. Рекомендуется повторное обнаружение.",
      });
    }

    return JSON.stringify({
      integration: integration.name,
      totalEntities: integration.entityCount,
      sections: Object.keys(catalog.sections),
      index: catalog.index,
    });
  },
});
