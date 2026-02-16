import { registerNativeTool } from "./registry";
import { prisma } from "../prisma";

// ─── create_task ───────────────────────────────────────

registerNativeTool({
  name: "create_task",
  description:
    "Создаёт задачу-чеклист для пользователя. Используй когда пользователь просит создать задачу, to-do или чек-лист, или когда нужно зафиксировать план действий.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Название задачи",
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "Описание шага" },
            done: { type: "boolean", description: "Выполнен ли шаг" },
          },
          required: ["text"],
        },
        description: "Список шагов чек-листа",
      },
    },
    required: ["title", "steps"],
  },
  async execute(args, ctx) {
    const title = args.title as string;
    const steps = (args.steps as Array<{ text: string; done?: boolean }>).map((s) => ({
      text: s.text,
      done: s.done ?? false,
    }));

    const task = await prisma.task.create({
      data: {
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        title,
        steps,
        status: "IN_PROGRESS",
        progress: 0,
      },
    });

    return JSON.stringify({
      success: true,
      taskId: task.id,
      title: task.title,
      stepsCount: steps.length,
    });
  },
});

// ─── save_memory ───────────────────────────────────────

registerNativeTool({
  name: "save_memory",
  description:
    "Сохраняет информацию в долговременную память пользователя. Используй когда пользователь просит запомнить что-то (предпочтения, стандарты, контакты) или когда выявляешь важные паттерны для будущих сессий.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Уникальный ключ памяти (латиницей, snake_case). Например: preferred_language, company_name",
      },
      content: {
        type: "string",
        description: "Содержимое для сохранения",
      },
    },
    required: ["key", "content"],
  },
  async execute(args, ctx) {
    const key = args.key as string;
    const content = args.content as string;

    const memory = await prisma.userMemory.upsert({
      where: { userId_key: { userId: ctx.userId, key } },
      create: {
        userId: ctx.userId,
        key,
        content,
        source: "native_tool",
      },
      update: {
        content,
        source: "native_tool",
      },
    });

    return JSON.stringify({
      success: true,
      memoryId: memory.id,
      key: memory.key,
      action: memory.createdAt.getTime() === memory.updatedAt.getTime() ? "created" : "updated",
    });
  },
});

// ─── send_notification ─────────────────────────────────

registerNativeTool({
  name: "send_notification",
  description:
    "Отправляет уведомление пользователю. Используй когда нужно уведомить о завершении задачи, напоминании или важном событии.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Заголовок уведомления",
      },
      message: {
        type: "string",
        description: "Текст уведомления",
      },
    },
    required: ["title", "message"],
  },
  async execute(args, ctx) {
    const title = args.title as string;
    const message = args.message as string;

    const notification = await prisma.notification.create({
      data: {
        userId: ctx.userId,
        type: "INFO",
        title,
        message,
      },
    });

    return JSON.stringify({
      success: true,
      notificationId: notification.id,
    });
  },
});

// ─── write_scratchpad ──────────────────────────────────

registerNativeTool({
  name: "write_scratchpad",
  description:
    "Записывает заметку в блокнот текущего разговора. Используй для сохранения промежуточных результатов, планов, собранных данных при длинных сессиях. Заметки сохраняются между сообщениями в рамках одного разговора.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Ключ заметки (латиницей, snake_case). Например: api_schema, collected_data, analysis_plan",
      },
      content: {
        type: "string",
        description: "Содержимое заметки (markdown)",
      },
    },
    required: ["key", "content"],
  },
  async execute(args, ctx) {
    if (!ctx.conversationId) {
      return JSON.stringify({ error: "Нет активного разговора" });
    }

    const key = args.key as string;
    const content = args.content as string;

    const note = await prisma.scratchpad.upsert({
      where: {
        conversationId_key: { conversationId: ctx.conversationId, key },
      },
      create: { conversationId: ctx.conversationId, key, content },
      update: { content },
    });

    return JSON.stringify({
      success: true,
      key: note.key,
      action: note.createdAt.getTime() === note.updatedAt.getTime() ? "created" : "updated",
    });
  },
});

// ─── read_scratchpad ───────────────────────────────────

registerNativeTool({
  name: "read_scratchpad",
  description:
    "Читает заметки из блокнота текущего разговора. Без параметров — возвращает список всех ключей. С ключом — возвращает содержимое конкретной заметки.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Ключ заметки для чтения. Если не указан — возвращает список всех заметок.",
      },
    },
  },
  async execute(args, ctx) {
    if (!ctx.conversationId) {
      return JSON.stringify({ error: "Нет активного разговора" });
    }

    const key = args.key as string | undefined;

    if (key) {
      const note = await prisma.scratchpad.findUnique({
        where: {
          conversationId_key: { conversationId: ctx.conversationId, key },
        },
      });

      if (!note) {
        return JSON.stringify({ error: `Заметка "${key}" не найдена` });
      }

      return JSON.stringify({ key: note.key, content: note.content, updatedAt: note.updatedAt });
    }

    // List all scratchpad keys
    const notes = await prisma.scratchpad.findMany({
      where: { conversationId: ctx.conversationId },
      select: { key: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    return JSON.stringify({
      count: notes.length,
      notes: notes.map((n) => ({ key: n.key, updatedAt: n.updatedAt })),
    });
  },
});
