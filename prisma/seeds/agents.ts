import type { PrismaClient } from "@prisma/client";
import {
  SANBAO_SYSTEM_PROMPT,
  FEMIDA_SYSTEM_PROMPT,
  BROKER_SYSTEM_PROMPT,
  ACCOUNTANT_SYSTEM_PROMPT,
  CONSULTANT_1C_SYSTEM_PROMPT,
  GITHUB_PROMPT,
  SQL_PROMPT,
  RESEARCHER_PROMPT,
  FILEMANAGER_PROMPT,
  QA_PROMPT,
} from "./prompts";
import type { SpecializedAgentDef } from "./utils";

/** Agent IDs exported for cross-referencing in tools and MCP modules */
export const AGENT_IDS = {
  sanbao: "system-sanbao-agent",
  femida: "system-femida-agent",
  broker: "system-broker-agent",
  accountant: "system-accountant-agent",
  consultant1c: "system-1c-assistant-agent",
  github: "system-github-agent",
  sql: "system-sql-agent",
  researcher: "system-researcher-agent",
  filemanager: "system-filemanager-agent",
  qa: "system-qa-agent",
} as const;

/**
 * Seed all system agents (core + specialized).
 * Must run before tools and MCP seeding since those reference agent IDs.
 */
export async function seedAgents(prisma: PrismaClient): Promise<void> {
  // ─── Core System Agents ─────────────────────────────────────

  await prisma.agent.upsert({
    where: { id: AGENT_IDS.sanbao },
    update: {
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      instructions: SANBAO_SYSTEM_PROMPT,
      icon: "Bot",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 0,
      status: "APPROVED",
    },
    create: {
      id: AGENT_IDS.sanbao,
      name: "Sanbao",
      description: "универсальный AI-ассистент",
      instructions: SANBAO_SYSTEM_PROMPT,
      icon: "Bot",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 0,
      status: "APPROVED",
    },
  });

  await prisma.agent.upsert({
    where: { id: AGENT_IDS.femida },
    update: {
      name: "Юрист",
      description: "AI-ассистент для работы с договорами, исками и НПА Республики Казахстан",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
      starterPrompts: [
        "Что говорит статья 188 УК РК?",
        "Составь договор оказания услуг",
        "Какие права у работника при увольнении по ТК РК?",
        "Найди последние изменения в Налоговом кодексе",
      ],
    },
    create: {
      id: AGENT_IDS.femida,
      name: "Юрист",
      description: "AI-ассистент для работы с договорами, исками и НПА Республики Казахстан",
      instructions: FEMIDA_SYSTEM_PROMPT,
      icon: "Scale",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 1,
      status: "APPROVED",
      starterPrompts: [
        "Что говорит статья 188 УК РК?",
        "Составь договор оказания услуг",
        "Какие права у работника при увольнении по ТК РК?",
        "Найди последние изменения в Налоговом кодексе",
      ],
    },
  });

  await prisma.agent.upsert({
    where: { id: AGENT_IDS.broker },
    update: {
      name: "Таможенный брокер",
      description: "AI-ассистент по таможенному оформлению, классификации товаров и расчёту пошлин ЕАЭС",
      instructions: BROKER_SYSTEM_PROMPT,
      icon: "Package",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 8,
      status: "APPROVED",
      starterPrompts: [
        "Классифицируй iPhone 16 Pro по ТН ВЭД",
        "Рассчитай пошлины на ввоз автомобиля из Китая",
        "Какие документы нужны для импорта продуктов питания?",
        "Создай таможенную декларацию на импорт электроники",
      ],
    },
    create: {
      id: AGENT_IDS.broker,
      name: "Таможенный брокер",
      description: "AI-ассистент по таможенному оформлению, классификации товаров и расчёту пошлин ЕАЭС",
      instructions: BROKER_SYSTEM_PROMPT,
      icon: "Package",
      iconColor: "#8FAF9F",
      isSystem: true,
      sortOrder: 8,
      status: "APPROVED",
      starterPrompts: [
        "Классифицируй iPhone 16 Pro по ТН ВЭД",
        "Рассчитай пошлины на ввоз автомобиля из Китая",
        "Какие документы нужны для импорта продуктов питания?",
        "Создай таможенную декларацию на импорт электроники",
      ],
    },
  });

  console.log("System agents seeded: Sanbao, Юрист, Таможенный брокер");

  await prisma.agent.upsert({
    where: { id: AGENT_IDS.accountant },
    update: {
      name: "Бухгалтер",
      description: "AI-ассистент по бухгалтерскому и налоговому учёту для Республики Казахстан",
      instructions: ACCOUNTANT_SYSTEM_PROMPT,
      icon: "Calculator",
      iconColor: "#059669",
      isSystem: true,
      sortOrder: 2,
      status: "APPROVED",
      starterPrompts: [
        "Как начислить зарплату в 1С?",
        "Рассчитай налоги с зарплаты 350 000 ₸",
        "Какие проводки при покупке основного средства?",
        "Помоги заполнить форму 910 за 1 квартал",
      ],
    },
    create: {
      id: AGENT_IDS.accountant,
      name: "Бухгалтер",
      description: "AI-ассистент по бухгалтерскому и налоговому учёту для Республики Казахстан",
      instructions: ACCOUNTANT_SYSTEM_PROMPT,
      icon: "Calculator",
      iconColor: "#059669",
      isSystem: true,
      sortOrder: 2,
      status: "APPROVED",
      starterPrompts: [
        "Как начислить зарплату в 1С?",
        "Рассчитай налоги с зарплаты 350 000 ₸",
        "Какие проводки при покупке основного средства?",
        "Помоги заполнить форму 910 за 1 квартал",
      ],
    },
  });

  console.log("System agent seeded: Бухгалтер");

  await prisma.agent.upsert({
    where: { id: AGENT_IDS.consultant1c },
    update: {
      name: "1С Ассистент",
      description: "AI-ассистент по платформе 1С:Предприятие — код, запросы, конфигурации",
      instructions: CONSULTANT_1C_SYSTEM_PROMPT,
      icon: "Wrench",
      iconColor: "#F97316",
      isSystem: true,
      sortOrder: 3,
      status: "APPROVED",
      starterPrompts: [
        "Как настроить обмен данными в 1С?",
        "Напиши запрос 1С для остатков на складе",
        "Как подключить БСП модуль в конфигурацию?",
        "Оптимизируй медленный запрос 1С",
      ],
    },
    create: {
      id: AGENT_IDS.consultant1c,
      name: "1С Ассистент",
      description: "AI-ассистент по платформе 1С:Предприятие — код, запросы, конфигурации",
      instructions: CONSULTANT_1C_SYSTEM_PROMPT,
      icon: "Wrench",
      iconColor: "#F97316",
      isSystem: true,
      sortOrder: 3,
      status: "APPROVED",
      starterPrompts: [
        "Как настроить обмен данными в 1С?",
        "Напиши запрос 1С для остатков на складе",
        "Как подключить БСП модуль в конфигурацию?",
        "Оптимизируй медленный запрос 1С",
      ],
    },
  });

  console.log("System agent seeded: 1С Ассистент");

  // ─── Specialized System Agents ─────────────────────────────────

  const specializedAgents: SpecializedAgentDef[] = [
    {
      id: AGENT_IDS.github,
      name: "GitHub Разработчик",
      description: "code review, управление PR, issues и репозиториями через GitHub MCP",
      instructions: GITHUB_PROMPT,
      icon: "Code",
      iconColor: "#8FAF9F",
      sortOrder: 3,
      starterPrompts: [
        "Покажи открытые pull requests в репозитории",
        "Сделай code review последнего PR",
        "Создай issue для отслеживания бага",
        "Покажи последние коммиты в main",
      ],
      mcp: {
        id: "mcp-github",
        name: "GitHub",
        url: process.env.GITHUB_MCP_URL || "http://localhost:3101/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: process.env.GITHUB_MCP_TOKEN || null,
      },
    },
    {
      id: AGENT_IDS.sql,
      name: "SQL Аналитик",
      description: "SQL запросы, анализ данных, оптимизация и отчёты через PostgreSQL MCP",
      instructions: SQL_PROMPT,
      icon: "FileSearch",
      iconColor: "#8FAF9F",
      sortOrder: 4,
      starterPrompts: [
        "Покажи структуру базы данных",
        "Напиши SQL для анализа продаж за месяц",
        "Оптимизируй медленный запрос",
        "Создай отчёт по активности пользователей",
      ],
      mcp: {
        id: "mcp-postgres",
        name: "PostgreSQL",
        url: process.env.POSTGRES_MCP_URL || "http://localhost:3102/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
    {
      id: AGENT_IDS.researcher,
      name: "Веб-Исследователь",
      description: "глубокое исследование тем, fact-checking и аналитика через Brave Search MCP",
      instructions: RESEARCHER_PROMPT,
      icon: "Globe",
      iconColor: "#8FAF9F",
      sortOrder: 5,
      starterPrompts: [
        "Исследуй тренды AI в 2026 году",
        "Проверь достоверность утверждения",
        "Сравни конкурентов в нише",
        "Найди последние исследования по теме",
      ],
      mcp: {
        id: "mcp-brave-search",
        name: "Brave Search",
        url: process.env.BRAVE_MCP_URL || "http://localhost:3103/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: process.env.BRAVE_MCP_TOKEN || null,
      },
    },
    {
      id: AGENT_IDS.filemanager,
      name: "Файловый Ассистент",
      description: "работа с файлами и директориями через Filesystem MCP",
      instructions: FILEMANAGER_PROMPT,
      icon: "FileText",
      iconColor: "#8FAF9F",
      sortOrder: 6,
      starterPrompts: [
        "Покажи структуру текущей директории",
        "Найди все файлы с расширением .json",
        "Прочитай содержимое конфигурации",
        "Организуй файлы по папкам",
      ],
      mcp: {
        id: "mcp-filesystem",
        name: "Filesystem",
        url: process.env.FILESYSTEM_MCP_URL || "http://localhost:3104/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
    {
      id: AGENT_IDS.qa,
      name: "QA Инженер",
      description: "тестирование веб-приложений и автоматизация через Playwright MCP",
      instructions: QA_PROMPT,
      icon: "ShieldCheck",
      iconColor: "#8FAF9F",
      sortOrder: 7,
      starterPrompts: [
        "Протестируй форму логина на сайте",
        "Проверь адаптивность на мобильных",
        "Сделай скриншот главной страницы",
        "Проверь accessibility формы",
      ],
      mcp: {
        id: "mcp-playwright",
        name: "Playwright",
        url: process.env.PLAYWRIGHT_MCP_URL || "http://localhost:3105/mcp",
        transport: "STREAMABLE_HTTP",
        apiKey: null,
      },
    },
  ];

  for (const sa of specializedAgents) {
    const agent = await prisma.agent.upsert({
      where: { id: sa.id },
      update: {
        name: sa.name,
        description: sa.description,
        instructions: sa.instructions,
        icon: sa.icon,
        iconColor: sa.iconColor,
        isSystem: true,
        sortOrder: sa.sortOrder,
        status: "APPROVED",
        starterPrompts: sa.starterPrompts,
      },
      create: {
        id: sa.id,
        name: sa.name,
        description: sa.description,
        instructions: sa.instructions,
        icon: sa.icon,
        iconColor: sa.iconColor,
        isSystem: true,
        sortOrder: sa.sortOrder,
        status: "APPROVED",
        starterPrompts: sa.starterPrompts,
      },
    });

    // Create MCP server and link for each specialized agent
    const mcpServer = await prisma.mcpServer.upsert({
      where: { id: sa.mcp.id },
      update: {
        name: sa.mcp.name,
        url: sa.mcp.url,
        transport: sa.mcp.transport,
        apiKey: sa.mcp.apiKey,
        isGlobal: true,
      },
      create: {
        id: sa.mcp.id,
        name: sa.mcp.name,
        url: sa.mcp.url,
        transport: sa.mcp.transport,
        apiKey: sa.mcp.apiKey,
        isGlobal: true,
        status: "DISCONNECTED",
      },
    });

    await prisma.agentMcpServer.upsert({
      where: {
        agentId_mcpServerId: { agentId: agent.id, mcpServerId: mcpServer.id },
      },
      update: {},
      create: { agentId: agent.id, mcpServerId: mcpServer.id },
    });
  }

  console.log(`Specialized agents seeded: ${specializedAgents.length} agents with MCP servers`);
}
