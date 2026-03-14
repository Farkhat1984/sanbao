// ─── odata_catalog — Browse the 1C OData entity catalog ─

import { registerNativeTool } from "../../registry";
import { getIntegrationForUser } from "../_helpers";
import { parseHierarchicalCatalog } from "@/lib/odata-catalog";

registerNativeTool({
  name: "odata_catalog",
  description:
    "Показывает каталог сущностей 1С OData. Без параметра section возвращает оглавление (список категорий). С параметром section — список сущностей в выбранной категории. Используй для навигации по структуре базы 1С перед запросом данных.",
  parameters: {
    type: "object",
    properties: {
      section: {
        type: "string",
        description:
          'Slug категории из оглавления (например "warehouse", "sales", "hr"). Если не указан — возвращает оглавление.',
      },
      integration_name: {
        type: "string",
        description:
          "Название интеграции (если у пользователя несколько). Если не указано — используется первая подключённая.",
      },
    },
  },
  async execute(args, ctx) {
    const section = args.section as string | undefined;
    const integrationName = args.integration_name as string | undefined;

    const integration = await getIntegrationForUser(ctx.userId, integrationName);
    if (!integration) {
      return JSON.stringify({
        error: "Нет подключённой интеграции 1С. Попросите пользователя настроить интеграцию в разделе настроек.",
      });
    }

    if (!integration.catalog) {
      return JSON.stringify({
        error: "Каталог ещё не сформирован. Необходимо запустить обнаружение сущностей для интеграции.",
      });
    }

    const catalog = parseHierarchicalCatalog(integration.catalog);
    if (!catalog) {
      // Legacy or malformed catalog — return raw
      return JSON.stringify({
        integration: integration.name,
        format: "legacy",
        catalog: integration.catalog.slice(0, 10000),
      });
    }

    if (!section) {
      // Return the index (table of contents)
      return JSON.stringify({
        integration: integration.name,
        entityCount: integration.entityCount,
        index: catalog.index,
        availableSections: Object.keys(catalog.sections),
      });
    }

    // Return a specific section
    const sectionContent = catalog.sections[section];
    if (!sectionContent) {
      return JSON.stringify({
        error: `Секция "${section}" не найдена.`,
        availableSections: Object.keys(catalog.sections),
      });
    }

    return JSON.stringify({
      integration: integration.name,
      section,
      content: sectionContent,
    });
  },
});
