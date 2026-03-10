import type { PrismaClient } from "@prisma/client";
import { upsertToolsWithAgentLink } from "./utils";
import type { ToolDefinition } from "./utils";

/**
 * Seed global prompt template tools (not linked to any agent).
 */
export async function seedTools(prisma: PrismaClient): Promise<void> {
  const generalTools: ToolDefinition[] = [
    {
      id: "tool-gen-image",
      name: "Создать картинку",
      description: "Сгенерировать изображение по описанию",
      icon: "Sparkles",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Создай изображение: уютная кофейня в дождливый вечер, тёплый свет из окон, акварельный стиль",
      },
      sortOrder: 0,
    },
    {
      id: "tool-gen-document",
      name: "Написать документ",
      description: "Письмо, статья, план или отчёт",
      icon: "FileText",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Помоги написать профессиональное деловое письмо с благодарностью партнёру за сотрудничество",
      },
      sortOrder: 1,
    },
    {
      id: "tool-gen-search",
      name: "Найти в интернете",
      description: "Поиск актуальной информации в сети",
      icon: "Globe",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Найди последние новости и тренды в области искусственного интеллекта за 2025 год",
      },
      sortOrder: 2,
    },
    {
      id: "tool-gen-code",
      name: "Написать код",
      description: "Скрипт, функция или полноценный проект",
      icon: "Code",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Напиши скрипт на Python который парсит CSV файл, анализирует данные и строит график с помощью matplotlib",
      },
      sortOrder: 3,
    },
  ];

  await upsertToolsWithAgentLink(prisma, generalTools);
  console.log(`General tools seeded: ${generalTools.length} tools`);
}
