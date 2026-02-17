import { registerNativeTool } from "./registry";
import { prisma } from "../prisma";

// ─── read_knowledge ────────────────────────────────────

registerNativeTool({
  name: "read_knowledge",
  description:
    "Ищет информацию в файлах знаний агента и в пользовательских файлах. Используй когда нужно найти данные из загруженных документов (API-схемы, инструкции, справочники, заметки пользователя).",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Поисковый запрос (ключевые слова или фраза)",
      },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const query = (args.query as string).toLowerCase();
    const MAX_FILES = 20;
    const MAX_RESPONSE_SIZE = 30_000; // ~30KB total response cap

    // Search agent files (if in agent context)
    const agentFiles = ctx.agentId
      ? await prisma.agentFile.findMany({
          where: { agentId: ctx.agentId, extractedText: { not: null } },
          select: { id: true, fileName: true, extractedText: true },
          take: MAX_FILES,
        })
      : [];

    // Search user files (always available)
    const userFiles = await prisma.userFile.findMany({
      where: { userId: ctx.userId },
      select: { id: true, name: true, content: true },
      take: MAX_FILES,
    });

    if (agentFiles.length === 0 && userFiles.length === 0) {
      return JSON.stringify({ results: [], message: "Нет доступных файлов знаний" });
    }

    // Substring search with context window
    const results: Array<{ fileName: string; source: string; snippets: string[] }> = [];
    let totalSize = 0;

    // Search agent files
    for (const file of agentFiles) {
      if (totalSize >= MAX_RESPONSE_SIZE) break;

      const text = file.extractedText || "";
      const lower = text.toLowerCase();
      const snippets: string[] = [];
      let pos = 0;

      while (snippets.length < 5 && totalSize < MAX_RESPONSE_SIZE) {
        const idx = lower.indexOf(query, pos);
        if (idx === -1) break;

        const start = Math.max(0, idx - 150);
        const end = Math.min(text.length, idx + query.length + 150);
        const snippet =
          (start > 0 ? "..." : "") +
          text.slice(start, end) +
          (end < text.length ? "..." : "");
        snippets.push(snippet);
        totalSize += snippet.length;
        pos = idx + query.length;
      }

      if (snippets.length > 0) {
        results.push({ fileName: file.fileName, source: "agent", snippets });
      }
    }

    // Search user files
    for (const file of userFiles) {
      if (totalSize >= MAX_RESPONSE_SIZE) break;

      const text = file.content || "";
      const lower = text.toLowerCase();
      const snippets: string[] = [];
      let pos = 0;

      while (snippets.length < 5 && totalSize < MAX_RESPONSE_SIZE) {
        const idx = lower.indexOf(query, pos);
        if (idx === -1) break;

        const start = Math.max(0, idx - 150);
        const end = Math.min(text.length, idx + query.length + 150);
        const snippet =
          (start > 0 ? "..." : "") +
          text.slice(start, end) +
          (end < text.length ? "..." : "");
        snippets.push(snippet);
        totalSize += snippet.length;
        pos = idx + query.length;
      }

      if (snippets.length > 0) {
        results.push({ fileName: file.name, source: "user", snippets });
      }
    }

    return JSON.stringify({
      query,
      filesSearched: agentFiles.length + userFiles.length,
      results,
    });
  },
});

// ─── search_knowledge ──────────────────────────────────

registerNativeTool({
  name: "search_knowledge",
  description:
    "Ищет в долговременной памяти пользователя. Используй когда нужно вспомнить сохранённые предпочтения, контакты или другую информацию из прошлых сессий.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Поисковый запрос по ключу или содержимому памяти",
      },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const query = (args.query as string).toLowerCase();

    const memories = await prisma.userMemory.findMany({
      where: { userId: ctx.userId },
      select: { key: true, content: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const matches = memories.filter(
      (m) =>
        m.key.toLowerCase().includes(query) ||
        m.content.toLowerCase().includes(query)
    );

    return JSON.stringify({
      query,
      totalMemories: memories.length,
      matches: matches.slice(0, 20).map((m) => ({
        key: m.key,
        content: m.content,
        updatedAt: m.updatedAt,
      })),
    });
  },
});

// ─── generate_chart_data ───────────────────────────────

type ChartType = "bar" | "line" | "pie" | "doughnut" | "radar";

interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
}

registerNativeTool({
  name: "generate_chart_data",
  description:
    "Генерирует JSON-данные для визуализации графика (Chart.js формат). Используй когда нужно показать данные в виде диаграммы: bar, line, pie, doughnut, radar.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["bar", "line", "pie", "doughnut", "radar"],
        description: "Тип графика",
      },
      title: {
        type: "string",
        description: "Заголовок графика",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Подписи оси X (или секторов для pie/doughnut)",
      },
      datasets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Название набора данных" },
            data: {
              type: "array",
              items: { type: "number" },
              description: "Числовые значения",
            },
          },
          required: ["data"],
        },
        description: "Наборы данных для графика",
      },
    },
    required: ["type", "labels", "datasets"],
  },
  async execute(args) {
    const chartType = args.type as ChartType;
    const title = args.title as string | undefined;
    const labels = args.labels as string[];
    const rawDatasets = args.datasets as Array<{ label?: string; data: number[] }>;

    // Default colors
    const COLORS = [
      "#4F6EF7", "#7C3AED", "#10B981", "#F59E0B",
      "#EF4444", "#EC4899", "#06B6D4", "#6366F1",
    ];

    const datasets: ChartDataset[] = rawDatasets.map((ds, i) => {
      const base: ChartDataset = {
        label: ds.label,
        data: ds.data,
      };

      if (chartType === "pie" || chartType === "doughnut") {
        base.backgroundColor = labels.map((_, j) => COLORS[j % COLORS.length]);
      } else {
        base.backgroundColor = COLORS[i % COLORS.length] + "80"; // with alpha
        base.borderColor = COLORS[i % COLORS.length];
      }

      return base;
    });

    // Validate data matches labels
    for (const ds of datasets) {
      if (ds.data.length !== labels.length) {
        return JSON.stringify({
          error: `Набор данных "${ds.label || ""}" имеет ${ds.data.length} значений, а подписей ${labels.length}`,
        });
      }
    }

    const chartData = {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          title: title ? { display: true, text: title } : undefined,
          legend: { display: datasets.length > 1 || chartType === "pie" || chartType === "doughnut" },
        },
      },
    };

    return JSON.stringify(chartData);
  },
});
