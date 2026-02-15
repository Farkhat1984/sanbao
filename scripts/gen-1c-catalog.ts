import { PrismaClient } from "@prisma/client";

const API_URL = "http://5.188.153.83:30801/autolink_logistic_kim/odata/standard.odata/";
const AUTH = "Basic YWlBZ2VudDpDa2RzaGZoMjMxMTYxIQ==";

async function main() {
  const res = await fetch(`${API_URL}?$format=json`, {
    headers: { Authorization: AUTH, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  const entities: string[] = json.value.map((v: { name: string }) => v.name);

  // Categorize
  const prefixes = [
    "Catalog",
    "Document",
    "AccumulationRegister",
    "InformationRegister",
    "AccountingRegister",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "ChartOfCharacteristicTypes",
  ];

  const catNames: Record<string, string> = {
    Catalog: "Справочники (Catalog)",
    Document: "Документы (Document)",
    AccumulationRegister: "Регистры накопления (AccumulationRegister)",
    InformationRegister: "Регистры сведений (InformationRegister)",
    AccountingRegister: "Регистры бухгалтерии (AccountingRegister)",
    ChartOfAccounts: "Планы счетов (ChartOfAccounts)",
    ChartOfCalculationTypes: "Планы видов расчета (ChartOfCalculationTypes)",
    ChartOfCharacteristicTypes: "Планы видов характеристик (ChartOfCharacteristicTypes)",
  };

  const cats: Record<string, string[]> = {};
  for (const p of prefixes) cats[p] = [];
  const subTables = new Map<string, string[]>();

  for (const name of entities) {
    if (name.endsWith("_RecordType")) continue;

    let cat: string | null = null;
    let rest = name;
    for (const prefix of prefixes) {
      if (name.startsWith(prefix + "_")) {
        cat = prefix;
        rest = name.slice(prefix.length + 1);
        break;
      }
    }
    if (cat === null) continue;

    // Detect sub-tables for Documents and Catalogs
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

  // Build MD
  const lines: string[] = [];
  lines.push("# Структура OData API 1С — Autolink Logistics");
  lines.push("");
  lines.push(`Базовый URL: ${API_URL}`);
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
    lines.push(`## ${catNames[cat]}`);
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
  lines.push("- Табличные части: `Document_Имя_ТабличнаяЧасть` — отдельный endpoint");
  lines.push("- `_ДополнительныеРеквизиты` — динамические пользовательские поля");
  lines.push("- Префикс `gosu_` — кастомные объекты терминала (ворота, зоны, пломбы, приёмка, отгрузка)");
  lines.push("");
  lines.push("## Типичные запросы");
  lines.push("");
  lines.push("```");
  lines.push("# Список контрагентов");
  lines.push("GET Catalog_Контрагенты?$format=json&$top=10");
  lines.push("");
  lines.push("# Реализация за период");
  lines.push("GET Document_РеализацияТоваровУслуг?$format=json&$filter=Date gt datetime'2026-01-01'");
  lines.push("");
  lines.push("# Товары в документе поступления");
  lines.push("GET Document_ПоступлениеТоваровУслуг_Товары?$format=json&$top=5");
  lines.push("```");

  const md = lines.join("\n");
  console.log(`Generated MD: ${md.length} chars, ${lines.length} lines`);

  // Save as AgentFile
  const prisma = new PrismaClient();
  try {
    // Find the agent
    const agent = await prisma.agent.findFirst({
      where: { name: "Аналитик 1С" },
    });
    if (!agent) {
      console.error("Agent 'Аналитик 1С' not found!");
      return;
    }
    console.log(`Agent: ${agent.id} — ${agent.name}`);

    // Upsert the file
    const existing = await prisma.agentFile.findFirst({
      where: { agentId: agent.id, fileName: "1c-odata-catalog.md" },
    });

    if (existing) {
      await prisma.agentFile.update({
        where: { id: existing.id },
        data: { extractedText: md },
      });
      console.log("Updated existing AgentFile:", existing.id);
    } else {
      const file = await prisma.agentFile.create({
        data: {
          agentId: agent.id,
          fileName: "1c-odata-catalog.md",
          fileType: "text/markdown",
          fileUrl: "inline://1c-odata-catalog.md",
          fileSize: Buffer.byteLength(md, "utf-8"),
          extractedText: md,
          inContext: true,
        },
      });
      console.log("Created AgentFile:", file.id);
    }

    // Update agent instructions to reference the knowledge file
    const extraPrompt = `\n\n## База знаний\n\nТебе прикреплён файл "1c-odata-catalog.md" со списком всех таблиц 1С.\nИспользуй его для поиска нужных таблиц вместо запроса к корню API.\nЕсли пользователь спрашивает про конкретную сущность — найди её в файле и сразу формируй запрос.`;

    if (!agent.instructions.includes("1c-odata-catalog.md")) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { instructions: agent.instructions + extraPrompt },
      });
      console.log("Updated agent instructions with knowledge reference");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
