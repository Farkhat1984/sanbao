/**
 * OData Hierarchical Catalog — organizes 1C OData entities into
 * business domain categories using LLM-based classification.
 * Only a compact index goes into the AI system prompt; full sections
 * are loaded on-demand via the odata_catalog native tool.
 */

import { resolveModel } from "@/lib/model-router";
import { LLM_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";

const ODATA_PREFIXES = [
  "Catalog",
  "Document",
  "AccumulationRegister",
  "InformationRegister",
  "AccountingRegister",
  "ChartOfAccounts",
  "ChartOfCalculationTypes",
  "ChartOfCharacteristicTypes",
] as const;

const CATEGORY_NAMES: Record<string, string> = {
  Catalog: "Справочники (Catalog)",
  Document: "Документы (Document)",
  AccumulationRegister: "Регистры накопления (AccumulationRegister)",
  InformationRegister: "Регистры сведений (InformationRegister)",
  AccountingRegister: "Регистры бухгалтерии (AccountingRegister)",
  ChartOfAccounts: "Планы счетов (ChartOfAccounts)",
  ChartOfCalculationTypes: "Планы видов расчета (ChartOfCalculationTypes)",
  ChartOfCharacteristicTypes: "Планы видов характеристик (ChartOfCharacteristicTypes)",
};

export interface HierarchicalCatalog {
  version: 2;
  index: string;
  sections: Record<string, string>;
}

interface EntityInfo {
  /** Bare name without OData prefix, e.g. "Контрагенты" */
  name: string;
  /** Full OData name, e.g. "Catalog_Контрагенты" */
  fullName: string;
  /** OData prefix, e.g. "Catalog" */
  prefix: string;
  /** Sub-table names if any */
  subTables: string[];
}

interface LLMDomainMapping {
  /** slug -> Russian label, e.g. { "warehouse": "Склад и логистика" } */
  domains: Record<string, string>;
  /** slug -> entity full names */
  mapping: Record<string, string[]>;
}

const LLM_BATCH_SIZE = 500;

/**
 * Categorize OData entity names into business domains using an LLM.
 * Falls back to a single "all" domain if the LLM is unavailable or returns invalid data.
 */
async function categorizeEntitiesWithLLM(
  entityNames: string[]
): Promise<LLMDomainMapping> {
  const fallback: LLMDomainMapping = {
    domains: { all: "Все сущности" },
    mapping: { all: entityNames },
  };

  const model = await resolveModel("TEXT");
  if (!model) {
    logger.info("No TEXT model configured, using single-domain fallback", { context: "odata-catalog" });
    return fallback;
  }

  const batches: string[][] = [];
  for (let i = 0; i < entityNames.length; i += LLM_BATCH_SIZE) {
    batches.push(entityNames.slice(i, i + LLM_BATCH_SIZE));
  }

  let accumulatedDomains: Record<string, string> = {};
  let accumulatedMapping: Record<string, string[]> = {};

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const isFirst = i === 0;

    logger.info(`LLM batch ${i + 1}/${batches.length} — ${batch.length} entities`, { context: "odata-catalog" });

    const systemPrompt = isFirst
      ? `Ты — эксперт по 1С. Тебе дан список OData-сущностей из базы 1С.
Сгруппируй их по бизнес-категориям (5-12 категорий).

Правила:
- Slug категории: латиницей, snake_case (warehouse, sales, hr и т.д.)
- Label категории: на русском (Склад и логистика, Продажи и т.д.)
- Каждая сущность должна попасть ровно в одну категорию
- Если не можешь определить — ставь в "other" (Прочее)
- Не создавай категории с менее чем 3 сущностями — объединяй в other

Ответь строго в JSON:
{
  "domains": { "slug": "Русское название", ... },
  "mapping": { "slug": ["Entity1", "Entity2"], ... }
}`
      : `Ты — эксперт по 1С. Распредели OData-сущности по СУЩЕСТВУЮЩИМ категориям.
Если сущность не подходит ни в одну — ставь в "other".
Можешь создать новую категорию только если в неё попадёт 5+ сущностей.

Существующие категории:
${JSON.stringify(accumulatedDomains)}

Ответь строго в JSON:
{
  "domains": { ... все категории включая существующие и новые если есть ... },
  "mapping": { "slug": ["Entity1", "Entity2"], ... только сущности из этого батча ... }
}`;

    try {
      const res = await fetch(`${model.provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${model.provider.apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: batch.join("\n") },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        logger.error(`LLM batch ${i + 1} failed`, { context: "odata-catalog", status: res.status, body: errText.slice(0, 200) });
        return fallback;
      }

      const json = await res.json();
      const content: string = json.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as LLMDomainMapping;

      if (!parsed.domains || !parsed.mapping) {
        logger.error("LLM returned invalid structure, falling back", { context: "odata-catalog" });
        return fallback;
      }

      // Merge domains (later batches may add new ones)
      accumulatedDomains = { ...accumulatedDomains, ...parsed.domains };

      // Merge mapping
      for (const [slug, names] of Object.entries(parsed.mapping)) {
        if (!accumulatedMapping[slug]) accumulatedMapping[slug] = [];
        accumulatedMapping[slug].push(...names);
      }
    } catch (err) {
      logger.error(`LLM batch ${i + 1} error`, { context: "odata-catalog", error: err instanceof Error ? err.message : String(err) });
      return fallback;
    }
  }

  // Ensure "other" domain exists if any mapping references it
  if (accumulatedMapping["other"] && !accumulatedDomains["other"]) {
    accumulatedDomains["other"] = "Прочее";
  }

  return { domains: accumulatedDomains, mapping: accumulatedMapping };
}

/**
 * Build a hierarchical catalog from raw OData entity names.
 * Uses LLM to group entities by business domain, then organizes by OData prefix.
 */
export async function buildHierarchicalCatalog(params: {
  integrationName: string;
  baseUrl: string;
  entities: string[];
}): Promise<HierarchicalCatalog> {
  const { integrationName, entities } = params;

  // Phase 1: Parse entities — separate main entities from sub-tables
  const mainEntities: EntityInfo[] = [];
  const subTableMap = new Map<string, string[]>();

  for (const raw of entities) {
    if (raw.endsWith("_RecordType")) continue;

    let prefix: string | null = null;
    let rest = raw;

    for (const p of ODATA_PREFIXES) {
      if (raw.startsWith(p + "_")) {
        prefix = p;
        rest = raw.slice(p.length + 1);
        break;
      }
    }

    if (prefix === null) continue;

    // Detect sub-tables for Document, Catalog, ChartOf*
    if (prefix === "Document" || prefix === "Catalog" || prefix.startsWith("ChartOf")) {
      const underscoreIdx = rest.indexOf("_");
      if (underscoreIdx > 0) {
        const parentEntity = rest.slice(0, underscoreIdx);
        const subName = rest.slice(underscoreIdx + 1);
        const parentKey = `${prefix}_${parentEntity}`;
        if (!subTableMap.has(parentKey)) subTableMap.set(parentKey, []);
        subTableMap.get(parentKey)!.push(subName);
        continue;
      }
    }

    mainEntities.push({
      name: rest,
      fullName: `${prefix}_${rest}`,
      prefix,
      subTables: [],
    });
  }

  // Attach sub-tables to their parent entities
  for (const entity of mainEntities) {
    const subs = subTableMap.get(entity.fullName);
    if (subs) entity.subTables = subs;
  }

  // Phase 2: Categorize with LLM
  const allFullNames = mainEntities.map((e) => e.fullName);
  const llmMapping = await categorizeEntitiesWithLLM(allFullNames);

  // Phase 3: Build domain -> prefix -> EntityInfo[] grouping using LLM mapping
  const entityByFullName = new Map<string, EntityInfo>();
  for (const entity of mainEntities) {
    entityByFullName.set(entity.fullName, entity);
  }

  // Track which entities are assigned by the LLM
  const assignedFullNames = new Set<string>();
  const grouped = new Map<string, Map<string, EntityInfo[]>>();

  for (const [slug, fullNames] of Object.entries(llmMapping.mapping)) {
    for (const fullName of fullNames) {
      const entity = entityByFullName.get(fullName);
      if (!entity) continue; // LLM returned a name that doesn't exist — skip

      assignedFullNames.add(fullName);

      if (!grouped.has(slug)) grouped.set(slug, new Map());
      const prefixMap = grouped.get(slug)!;
      if (!prefixMap.has(entity.prefix)) prefixMap.set(entity.prefix, []);
      prefixMap.get(entity.prefix)!.push(entity);
    }
  }

  // Any parsed entities NOT in the LLM mapping → put in "other"
  for (const entity of mainEntities) {
    if (!assignedFullNames.has(entity.fullName)) {
      if (!llmMapping.domains["other"]) {
        llmMapping.domains["other"] = "Прочее";
      }

      if (!grouped.has("other")) grouped.set("other", new Map());
      const prefixMap = grouped.get("other")!;
      if (!prefixMap.has(entity.prefix)) prefixMap.set(entity.prefix, []);
      prefixMap.get(entity.prefix)!.push(entity);
    }
  }

  // Phase 4: Build index and section markdowns
  const sections: Record<string, string> = {};
  const indexRows: Array<{ label: string; count: number; slug: string }> = [];

  // Process domains in order: named domains first, "other" last
  const domainSlugs = Object.keys(llmMapping.domains).filter((s) => s !== "other");
  if (llmMapping.domains["other"] || grouped.has("other")) {
    domainSlugs.push("other");
  }

  for (const slug of domainSlugs) {
    const prefixMap = grouped.get(slug);
    if (!prefixMap) continue;

    const label = llmMapping.domains[slug] ?? "Прочее";

    let entityCount = 0;
    for (const items of prefixMap.values()) entityCount += items.length;

    indexRows.push({ label, count: entityCount, slug });

    // Build section markdown
    const sectionLines: string[] = [];
    sectionLines.push(`## ${label} (${entityCount} сущностей)`);
    sectionLines.push("");

    // Sort prefixes by ODATA_PREFIXES order
    const sortedPrefixes = [...prefixMap.keys()].sort((a, b) => {
      const ia = ODATA_PREFIXES.indexOf(a as (typeof ODATA_PREFIXES)[number]);
      const ib = ODATA_PREFIXES.indexOf(b as (typeof ODATA_PREFIXES)[number]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    for (const prefix of sortedPrefixes) {
      const items = prefixMap.get(prefix)!;
      sectionLines.push(`### ${CATEGORY_NAMES[prefix] || prefix}`);
      sectionLines.push("");

      for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
        if (item.subTables.length > 0) {
          sectionLines.push(
            `- **${item.name}** → \`${item.fullName}\` — табл. части: ${item.subTables.join(", ")}`
          );
        } else {
          sectionLines.push(`- ${item.name} → \`${item.fullName}\``);
        }
      }
      sectionLines.push("");
    }

    sections[slug] = sectionLines.join("\n").trim();
  }

  // Build index markdown
  const totalEntities = indexRows.reduce((sum, r) => sum + r.count, 0);

  const indexLines: string[] = [];
  indexLines.push(`# 1С OData — ${integrationName}`);
  indexLines.push("");
  indexLines.push("| Категория | Сущностей | Секция |");
  indexLines.push("|-----------|-----------|--------|");
  for (const row of indexRows) {
    indexLines.push(`| ${row.label} | ${row.count} | \`${row.slug}\` |`);
  }
  indexLines.push("");
  indexLines.push(`**Всего:** ${totalEntities} сущностей`);
  indexLines.push("");
  indexLines.push('> Для просмотра сущностей в категории используй `odata_catalog(section="...")`.');
  indexLines.push('> Для запросов к данным используй `odata_query(entity="Catalog_Контрагенты")`.');

  return {
    version: 2,
    index: indexLines.join("\n"),
    sections,
  };
}

/** Safely parse a catalog field. Returns null if legacy format or invalid JSON. */
export function parseHierarchicalCatalog(catalogStr: string): HierarchicalCatalog | null {
  try {
    const parsed = JSON.parse(catalogStr);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.version === 2 &&
      typeof parsed.index === "string" &&
      typeof parsed.sections === "object" &&
      parsed.sections !== null
    ) {
      return parsed as HierarchicalCatalog;
    }
    return null;
  } catch {
    return null;
  }
}
