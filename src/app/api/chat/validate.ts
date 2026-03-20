// ─── Request validation & usage checks for chat route ───
// Extracted from route.ts — handles body parsing, input validation,
// plan/usage checks, rate limiting, and content filtering.

import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-helpers";
import { getUserPlanAndUsage } from "@/lib/usage";
import { checkMinuteRateLimit } from "@/lib/rate-limit";
import { checkContentFilter } from "@/lib/content-filter";
import { getSettings } from "@/lib/settings";
import type { ChatAttachment } from "@/lib/chat/message-builder";

// ─── Zod Schemas ─────────────────────────────────────────

const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const chatAttachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  base64: z.string().optional(),
  textContent: z.string().optional(),
});

/** Runtime validation schema for the chat request body. */
export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  agentId: z.string().optional(),
  skillId: z.string().optional(),
  orgAgentId: z.string().optional(),
  thinkingEnabled: z.boolean().default(true),
  webSearchEnabled: z.boolean().default(false),
  attachments: z.array(chatAttachmentSchema).default([]),
  conversationId: z.string().optional(),
  swarmMode: z.boolean().default(false),
  swarmOrgId: z.string().optional(),
  multiAgentId: z.string().optional(),
});

// ─── Types ──────────────────────────────────────────────

export interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  agentId?: string;
  skillId?: string;
  orgAgentId?: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  attachments: ChatAttachment[];
  conversationId?: string;
  swarmMode: boolean;
  swarmOrgId?: string;
  multiAgentId?: string;
}

/** All dynamic settings loaded once per request. */
export interface ChatSettings {
  maxMessagesPerRequest: number;
  maxMessageSizeBytes: number;
  maxMcpTools: number;
  keepLastMessages: number;
  maxAttachments: number;
  userFilesContextLimit: number;
  compactionLockTtlS: number;
  defaultTemperature: number;
  defaultTopP: number;
  maxToolCallsPerRequest: number;
  maxRequestTokens: number;
  toolResultMaxChars: number;
  toolResultTailChars: number;
}

export interface UserPlanInfo {
  plan: NonNullable<Awaited<ReturnType<typeof getUserPlanAndUsage>>["plan"]>;
  usage: Awaited<ReturnType<typeof getUserPlanAndUsage>>["usage"];
  monthlyUsage: Awaited<ReturnType<typeof getUserPlanAndUsage>>["monthlyUsage"];
  isAdmin: boolean;
}

export interface ValidatedRequest {
  body: ChatRequestBody;
  settings: ChatSettings;
  planInfo: UserPlanInfo;
}

// ─── Settings loader ────────────────────────────────────

const SETTINGS_KEYS = [
  'chat_max_messages_per_request',
  'chat_max_message_size_bytes',
  'tool_max_mcp_per_agent',
  'tool_max_calls_per_request',
  'tool_max_turns',
  'ai_max_request_tokens',
  'ai_default_temperature',
  'ai_default_max_tokens',
  'ai_default_top_p',
  'ai_default_context_window',
  'context_compaction_threshold',
  'context_keep_last_messages',
  'tool_result_max_chars',
  'tool_result_tail_chars',
  'chat_max_attachments',
  'chat_user_files_context_limit',
  'chat_compaction_lock_ttl_s',
] as const;

function parseSettings(cfg: Record<string, string>): ChatSettings {
  return {
    maxMessagesPerRequest: Number(cfg['chat_max_messages_per_request']),
    maxMessageSizeBytes: Number(cfg['chat_max_message_size_bytes']),
    maxMcpTools: Number(cfg['tool_max_mcp_per_agent']),
    keepLastMessages: Number(cfg['context_keep_last_messages']),
    maxAttachments: Number(cfg['chat_max_attachments']),
    userFilesContextLimit: Number(cfg['chat_user_files_context_limit']),
    compactionLockTtlS: Number(cfg['chat_compaction_lock_ttl_s']),
    defaultTemperature: Number(cfg['ai_default_temperature']),
    defaultTopP: Number(cfg['ai_default_top_p']),
    maxToolCallsPerRequest: Number(cfg['tool_max_calls_per_request']),
    maxRequestTokens: Number(cfg['ai_max_request_tokens']),
    toolResultMaxChars: Number(cfg['tool_result_max_chars']),
    toolResultTailChars: Number(cfg['tool_result_tail_chars']),
  };
}

// ─── Body parser ────────────────────────────────────────

/**
 * Parse and validate the chat request body using Zod schema.
 * Returns the validated body or null if validation fails.
 */
export function parseChatBody(body: Record<string, unknown>): ChatRequestBody | null {
  const result = chatRequestSchema.safeParse(body);
  if (!result.success) return null;
  // Cast is safe: Zod schema matches ChatRequestBody structure,
  // and ChatAttachment is a superset of the schema's attachment type.
  return result.data as ChatRequestBody;
}

// ─── Validation pipeline ────────────────────────────────

/**
 * Validate the chat request: parse body, load settings, check plan/usage/rate limits,
 * and run content filter.
 * Returns either a ValidatedRequest on success or an error Response.
 */
export async function validateChatRequest(
  userId: string,
  userRole: string | undefined,
  rawBody: Record<string, unknown>,
): Promise<{ data: ValidatedRequest } | { error: NextResponse | Response }> {
  const body = parseChatBody(rawBody);
  if (!body) {
    return { error: jsonError("Некорректный формат запроса", 400) };
  }

  // Load dynamic settings (single DB query, cached)
  const cfg = await getSettings([...SETTINGS_KEYS]);
  const settings = parseSettings(cfg);

  // Message count validation (Zod ensures min 1, check max against dynamic setting)
  if (body.messages.length > settings.maxMessagesPerRequest) {
    return { error: jsonError("Некорректный массив сообщений", 400) };
  }

  for (const msg of body.messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (content.length > settings.maxMessageSizeBytes) {
      return { error: jsonError("Сообщение превышает допустимый размер (100KB)", 400) };
    }
  }

  if (body.attachments.length > settings.maxAttachments) {
    return { error: jsonError(`Слишком много вложений (макс. ${settings.maxAttachments})`, 400) };
  }

  // Plan & usage checks
  const { plan, usage, monthlyUsage } = await getUserPlanAndUsage(userId);
  if (!plan) {
    return { error: jsonError("Нет настроенного тарифа", 500) };
  }

  const isAdmin = userRole === "ADMIN";

  if (!isAdmin) {
    if (plan.messagesPerDay > 0 && (usage?.messageCount ?? 0) >= plan.messagesPerDay) {
      return {
        error: NextResponse.json(
          { error: `Достигнут дневной лимит сообщений (${plan.messagesPerDay}). Перейдите на более объёмный тариф для увеличения лимита.`, limit: plan.messagesPerDay },
          { status: 429 }
        ),
      };
    }
    if (plan.tokensPerMonth > 0 && monthlyUsage.tokenCount >= plan.tokensPerMonth) {
      return {
        error: NextResponse.json(
          { error: "Достигнут месячный лимит токенов. Перейдите на более объёмный тариф для продолжения работы.", limit: plan.tokensPerMonth },
          { status: 429 }
        ),
      };
    }
    if (!(await checkMinuteRateLimit(userId, plan.requestsPerMinute))) {
      return { error: jsonError("Слишком много запросов. Подождите минуту.", 429) };
    }
    if (body.thinkingEnabled && !plan.canUseReasoning) {
      return { error: jsonError("Режим рассуждений доступен на тарифе Pro и выше. Обновите подписку в настройках.", 403) };
    }
  }

  // Content filter
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const filterResult = await checkContentFilter(
      typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)
    );
    if (filterResult.blocked) {
      return { error: jsonError("Сообщение содержит запрещённый контент и не может быть отправлено.", 400) };
    }
  }

  return {
    data: {
      body,
      settings,
      planInfo: { plan, usage, monthlyUsage, isAdmin },
    },
  };
}
