import { requireAuth, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const ROLE_LABELS: Record<string, string> = {
  USER: "Пользователь",
  ASSISTANT: "Ассистент",
  SYSTEM: "Система",
  TOOL: "Инструмент",
};

const ROLE_EMOJIS: Record<string, string> = {
  USER: "👤",
  ASSISTANT: "🤖",
  SYSTEM: "⚙️",
  TOOL: "🔧",
};

const VALID_FORMATS = new Set(["txt", "md"]);

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeZone: "Asia/Almaty",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeStyle: "medium",
  timeZone: "Asia/Almaty",
});

function formatTxt(
  title: string,
  createdAt: Date,
  messages: Array<{ role: string; content: string | null; createdAt: Date }>
): string {
  const header = [
    `Диалог: ${title}`,
    `Дата: ${dateFormatter.format(createdAt)}`,
    `Сообщений: ${messages.length}`,
    "=".repeat(60),
  ].join("\n");

  const body = messages
    .map((msg) => {
      const time = timeFormatter.format(msg.createdAt);
      const label = ROLE_LABELS[msg.role] ?? msg.role;
      return `[${time}] ${label}:\n${msg.content ?? ""}\n\n---`;
    })
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

function formatMd(
  title: string,
  createdAt: Date,
  messages: Array<{ role: string; content: string | null; createdAt: Date }>
): string {
  const header = [
    `# ${title}`,
    "",
    `**Дата:** ${dateFormatter.format(createdAt)}  `,
    `**Сообщений:** ${messages.length}`,
    "",
    "---",
  ].join("\n");

  const body = messages
    .map((msg) => {
      const time = timeFormatter.format(msg.createdAt);
      const label = ROLE_LABELS[msg.role] ?? msg.role;
      const emoji = ROLE_EMOJIS[msg.role] ?? "❓";
      return `### ${emoji} ${label} — ${time}\n\n${msg.content ?? ""}\n\n---`;
    })
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "txt";

  if (!VALID_FORMATS.has(format)) {
    return jsonError("Неверный формат. Допустимые значения: txt, md", 400);
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conversation) {
    return jsonError("Диалог не найден", 404);
  }

  if (conversation.messages.length === 0) {
    return jsonError("Нет сообщений для экспорта", 400);
  }

  const title = conversation.title || "Без названия";
  const content =
    format === "md"
      ? formatMd(title, conversation.createdAt, conversation.messages)
      : formatTxt(title, conversation.createdAt, conversation.messages);

  const filename = `dialog-${id.slice(0, 8)}-${Date.now()}.${format}`;
  const contentType =
    format === "md"
      ? "text/markdown; charset=utf-8"
      : "text/plain; charset=utf-8";

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
