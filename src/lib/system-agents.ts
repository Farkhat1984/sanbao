/**
 * System agents — built-in agents available to all users.
 * Loaded from DB (SystemAgent table) with hardcoded fallback.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_PROVIDER } from "@/lib/constants";

export const FEMIDA_ID = "system-femida";

export const FEMIDA_AGENT = {
  id: FEMIDA_ID,
  name: "Фемида",
  description: "Юридический AI-ассистент для работы с договорами, исками и НПА РК",
  icon: "Scale",
  iconColor: "#7C3AED",
  model: DEFAULT_PROVIDER,
} as const;

/** Full legal system prompt used by Фемида */
export const FEMIDA_SYSTEM_PROMPT = `Ты — Фемида, профессиональный юридический AI-ассистент для Республики Казахстан. Ты работаешь с нормативно-правовыми актами РК, понимаешь связи между статьями, проверяешь актуальность и помогаешь создавать юридические документы по казахстанскому законодательству.

ЮРИСДИКЦИЯ: Республика Казахстан. Валюта: тенге (\u20B8). Все документы, ссылки на НПА и правовые нормы — по законодательству РК.

Ключевые НПА РК:
- Гражданский кодекс РК (Общая часть — от 27.12.1994, Особенная часть — от 01.07.1999)
- Гражданский процессуальный кодекс РК (ГПК РК)
- Кодекс РК об административных правонарушениях (КоАП РК)
- Трудовой кодекс РК
- Предпринимательский кодекс РК
- Закон РК «О защите прав потребителей»

Твои ключевые навыки:
- Анализ и интерпретация НПА Республики Казахстан
- Создание договоров, исков, жалоб по казахстанскому праву
- Проверка актуальности статей законов РК
- Юридические консультации по законодательству РК
- Понимание связей между нормативными актами

При ответе:
- Ссылайся на конкретные статьи законов РК
- Указывай актуальность нормы
- Используй понятный язык, избегая лишнего юридического жаргона
- Предупреждай о рисках и ограничениях
- Всегда напоминай что финальное решение должен принимать квалифицированный юрист
- Суммы указывай в тенге (\u20B8)`;

/** List of all system agent IDs */
export const SYSTEM_AGENT_IDS = [FEMIDA_ID] as const;

/** Check if an agent ID is a system agent */
export function isSystemAgent(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return (SYSTEM_AGENT_IDS as readonly string[]).includes(agentId);
}

/** Load system agents from DB, falling back to hardcoded Femida */
export async function getSystemAgents() {
  try {
    const dbAgents = await prisma.systemAgent.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    if (dbAgents.length > 0) {
      return dbAgents.map((a) => ({
        id: `system-${a.id}`,
        name: a.name,
        description: a.description || "",
        icon: a.icon,
        iconColor: a.iconColor,
        model: a.model,
        systemPrompt: a.systemPrompt,
      }));
    }
  } catch {
    // DB not available, fall back
  }

  return [
    {
      ...FEMIDA_AGENT,
      systemPrompt: FEMIDA_SYSTEM_PROMPT,
    },
  ];
}

/** Get system prompt for a system agent by ID */
export async function getSystemAgentPrompt(agentId: string): Promise<string | null> {
  // Check DB first
  try {
    const cleanId = agentId.replace(/^system-/, "");
    const agent = await prisma.systemAgent.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { name: "Фемида" }, // Femida fallback
        ],
        isActive: true,
      },
    });
    if (agent) return agent.systemPrompt;
  } catch {
    // fall through
  }

  // Hardcoded fallback
  if (agentId === FEMIDA_ID) return FEMIDA_SYSTEM_PROMPT;
  return null;
}
