import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import { INTEGRATION_DISCOVERY_TIMEOUT_MS } from "@/lib/constants";

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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId },
  });
  if (!integration) return jsonError("Интеграция не найдена", 404);

  // SSRF re-check at discovery time (defense in depth)
  const safe = await isUrlSafeAsync(integration.baseUrl);
  if (!safe) {
    await prisma.integration.update({
      where: { id },
      data: { status: "ERROR", statusMessage: "URL не прошёл проверку безопасности" },
    });
    return jsonError("URL не прошёл проверку безопасности", 400);
  }

  // Set status to DISCOVERING
  await prisma.integration.update({
    where: { id },
    data: { status: "DISCOVERING", statusMessage: null },
  });

  try {
    // Decrypt credentials
    const basicAuth = decrypt(integration.credentials);

    // Fetch OData root
    const odataUrl = `${integration.baseUrl}${integration.baseUrl.includes("?") ? "&" : "?"}$format=json`;
    const res = await fetch(odataUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(INTEGRATION_DISCOVERY_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const entities: string[] = (json.value || []).map((v: { name: string }) => v.name);

    // Categorize
    const cats: Record<string, string[]> = {};
    for (const p of ODATA_PREFIXES) cats[p] = [];
    const subTables = new Map<string, string[]>();

    for (const name of entities) {
      if (name.endsWith("_RecordType")) continue;

      let cat: string | null = null;
      let rest = name;
      for (const prefix of ODATA_PREFIXES) {
        if (name.startsWith(prefix + "_")) {
          cat = prefix;
          rest = name.slice(prefix.length + 1);
          break;
        }
      }
      if (cat === null) continue;

      if (cat === "Document" || cat === "Catalog" || cat.startsWith("ChartOf")) {
        const underscoreIdx = rest.indexOf("_");
        if (underscoreIdx > 0) {
          const parentEntity = rest.slice(0, underscoreIdx);
          const subName = rest.slice(underscoreIdx + 1);
          const parentKey = cat + "_" + parentEntity;
          if (!subTables.has(parentKey)) subTables.set(parentKey, []);
          subTables.get(parentKey)!.push(subName);
          continue;
        }
      }

      cats[cat].push(rest);
    }

    // Build discoveredEntities summary
    const discoveredEntities: Record<string, number> = {};
    for (const [cat, items] of Object.entries(cats)) {
      if (items.length > 0) discoveredEntities[cat] = items.length;
    }
    const entityCount = Object.values(discoveredEntities).reduce((a, b) => a + b, 0);

    // Generate MD catalog
    const lines: string[] = [];
    lines.push(`# Структура OData API 1С — ${integration.name}`);
    lines.push("");
    lines.push(`Базовый URL: ${integration.baseUrl}`);
    lines.push("");
    lines.push("## Сводка");
    lines.push("");
    lines.push("| Тип | Кол-во |");
    lines.push("|-----|--------|");
    for (const [cat, items] of Object.entries(cats)) {
      if (items.length > 0) lines.push(`| ${cat} | ${items.length} |`);
    }
    lines.push("");

    for (const [cat, items] of Object.entries(cats)) {
      if (items.length === 0) continue;
      lines.push(`## ${CATEGORY_NAMES[cat] || cat}`);
      lines.push("");
      for (const item of items.sort()) {
        const fullName = cat + "_" + item;
        const subs = subTables.get(fullName);
        if (subs && subs.length > 0) {
          lines.push(`- **${item}** — табл. части: ${subs.join(", ")}`);
        } else {
          lines.push(`- ${item}`);
        }
      }
      lines.push("");
    }

    lines.push("## Примечания");
    lines.push("");
    lines.push("- Суффикс `_RecordType` у регистров — тип записи (приход/расход)");
    lines.push("- Табличные части: `Тип_Имя_ТабличнаяЧасть` — отдельный endpoint");
    lines.push("- `_ДополнительныеРеквизиты` — динамические пользовательские поля");

    const catalog = lines.join("\n");

    // Update integration
    const updated = await prisma.integration.update({
      where: { id },
      data: {
        status: "CONNECTED",
        statusMessage: null,
        catalog,
        discoveredEntities,
        entityCount,
        lastDiscoveredAt: new Date(),
      },
      select: {
        id: true, name: true, type: true, baseUrl: true, status: true,
        statusMessage: true, entityCount: true, lastDiscoveredAt: true,
        catalog: true, discoveredEntities: true, createdAt: true, updatedAt: true,
      },
    });

    return jsonOk(serializeDates(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.integration.update({
      where: { id },
      data: {
        status: "ERROR",
        statusMessage: message.slice(0, 500),
      },
    });
    return jsonError(`Ошибка обнаружения: ${message.slice(0, 200)}`, 500);
  }
}
