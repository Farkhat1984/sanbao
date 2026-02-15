import { registerNativeTool } from "./registry";
import { prisma } from "../prisma";

// ─── get_current_time ──────────────────────────────────

registerNativeTool({
  name: "get_current_time",
  description:
    "Возвращает текущую дату и время с часовым поясом. Используй когда нужна актуальная дата/время.",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "IANA часовой пояс, например 'Asia/Almaty'. По умолчанию UTC.",
      },
    },
  },
  async execute(args) {
    const tz = (args.timezone as string) || "UTC";
    try {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("ru-RU", {
        timeZone: tz,
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).format(now);
      return JSON.stringify({
        iso: now.toISOString(),
        formatted,
        timezone: tz,
        timestamp: now.getTime(),
      });
    } catch {
      return JSON.stringify({ error: `Неверный часовой пояс: ${tz}` });
    }
  },
});

// ─── get_user_info ─────────────────────────────────────

registerNativeTool({
  name: "get_user_info",
  description:
    "Возвращает информацию о текущем пользователе: имя, email, тарифный план, лимиты. Используй когда пользователь спрашивает о своём аккаунте или лимитах.",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute(_args, ctx) {
    return JSON.stringify({
      name: ctx.sessionUser.name || "Не указано",
      email: ctx.sessionUser.email || "Не указано",
      plan: ctx.planName || "Free",
      limits: ctx.planLimits || null,
    });
  },
});

// ─── get_conversation_context ──────────────────────────

registerNativeTool({
  name: "get_conversation_context",
  description:
    "Возвращает метаинформацию о текущем разговоре: количество сообщений, задачи, дата создания. Используй для ориентации в контексте диалога.",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute(_args, ctx) {
    if (!ctx.conversationId) {
      return JSON.stringify({ error: "Нет активного разговора" });
    }

    const [conversation, messageCount, tasks] = await Promise.all([
      prisma.conversation.findUnique({
        where: { id: ctx.conversationId },
        select: { title: true, createdAt: true, updatedAt: true },
      }),
      prisma.message.count({ where: { conversationId: ctx.conversationId } }),
      prisma.task.findMany({
        where: { conversationId: ctx.conversationId },
        select: { title: true, status: true, progress: true },
      }),
    ]);

    return JSON.stringify({
      conversationId: ctx.conversationId,
      title: conversation?.title || "Без названия",
      createdAt: conversation?.createdAt,
      updatedAt: conversation?.updatedAt,
      messageCount,
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        progress: t.progress,
      })),
    });
  },
});
