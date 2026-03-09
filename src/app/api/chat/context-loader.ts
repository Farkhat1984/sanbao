// ─── Context loading for chat route ─────────────────────
// Extracted from route.ts — handles conversation context from DB,
// memory building, user files, autocompaction, and message assembly.

import { prisma } from "@/lib/prisma";
import {
  estimateTokens,
  checkContextWindow,
  splitMessagesForCompaction,
  buildCompactionPrompt,
  buildSystemPromptWithContext,
} from "@/lib/context";
import { buildMemoryContext } from "@/lib/memory";
import { resolveModel, type ResolvedModel } from "@/lib/model-router";
import { incrementTokens } from "@/lib/usage";
import { getSettingNumber } from "@/lib/settings";
import { getRedis } from "@/lib/redis";
import { buildApiMessages, type ChatAttachment } from "@/lib/chat/message-builder";
import {
  DEFAULT_TEMPERATURE_COMPACTION,
} from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────

export interface ContextResult {
  /** Enriched system prompt (with summary, memory, tasks) */
  enrichedSystemPrompt: string;
  /** Final API messages ready for the provider */
  apiMessages: Array<Record<string, unknown>>;
  /** Context usage info for streaming */
  contextInfo: {
    usagePercent: number;
    totalTokens: number;
    contextWindowSize: number;
    compacting: boolean;
  };
  /** The raw system prompt before enrichment (for AI SDK path) */
  rawSystemPrompt: string;
  /** Effective messages (may be trimmed by compaction) */
  effectiveMessages: Array<{ role: string; content: string }>;
}

// ─── Background compaction ──────────────────────────────

async function compactInBackground(
  conversationId: string,
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>,
  maxTokens: number,
  userId: string,
  textModel?: ResolvedModel | null
) {
  const lockKey = `compact:${conversationId}`;
  try {
    // Acquire Redis lock to prevent parallel compactions on the same conversation
    const lockTtl = await getSettingNumber('chat_compaction_lock_ttl_s');
    const redis = getRedis();
    if (redis) {
      const acquired = await redis.set(lockKey, "1", "EX", lockTtl, "NX");
      if (!acquired) {
        // Another compaction is already running for this conversation — skip
        return;
      }
    }

    const compactionPrompt = await buildCompactionPrompt(existingSummary, messagesToSummarize);

    const model = textModel || await resolveModel("TEXT");
    if (!model) {
      console.error("[compact] No text model resolved from DB");
      return;
    }
    const apiUrl = `${model.provider.baseUrl}/chat/completions`;
    const apiKey = model.provider.apiKey;
    const modelId = model.modelId;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "You are a context compaction assistant." },
          { role: "user", content: compactionPrompt },
        ],
        max_tokens: maxTokens,
        temperature: DEFAULT_TEMPERATURE_COMPACTION,
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error(`[compaction] API error ${response.status} for conversation ${conversationId}`);
      return;
    }

    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content;

    if (summaryText) {
      await prisma.conversationSummary.upsert({
        where: { conversationId },
        create: {
          conversationId,
          content: summaryText,
          tokenEstimate: estimateTokens(summaryText),
          messagesCovered: messagesToSummarize.length,
          version: 1,
        },
        update: {
          content: summaryText,
          tokenEstimate: estimateTokens(summaryText),
          messagesCovered: { increment: messagesToSummarize.length },
          version: { increment: 1 },
        },
      });

      const compactionTokens = estimateTokens(compactionPrompt) + estimateTokens(summaryText);
      await incrementTokens(userId, compactionTokens);
    }
  } catch (err) {
    console.error("[compaction] Failed for conversation", conversationId, err instanceof Error ? err.message : err);
  } finally {
    // Release compaction lock so the conversation can be compacted again
    try {
      const redis = getRedis();
      if (redis) await redis.del(lockKey);
    } catch { /* ignore cleanup errors */ }
  }
}

// ─── Main context loader ────────────────────────────────

/**
 * Load all context for the chat request: conversation summary, plan memory,
 * user memories, active tasks, user files, and perform autocompaction if needed.
 * Returns the enriched system prompt and final API messages.
 */
export async function loadChatContext(params: {
  messages: Array<{ role: string; content: string }>;
  attachments: ChatAttachment[];
  conversationId?: string;
  userId: string;
  systemPrompt: string;
  planId: string;
  planContextWindowSize: number;
  planTokensPerMessage: number;
  keepLastMessages: number;
  userFilesContextLimit: number;
  textModel?: ResolvedModel | null;
}): Promise<ContextResult> {
  const {
    messages, attachments, conversationId, userId,
    planContextWindowSize, planTokensPerMessage,
    keepLastMessages, userFilesContextLimit, textModel,
  } = params;
  let { systemPrompt } = params;

  let existingSummary: string | null = null;
  let planMemory: string | null = null;
  let userMemoryContext: string | null = null;

  const [contextData, userMemories, activeTasks, userFiles] = await Promise.all([
    conversationId
      ? Promise.all([
          prisma.conversationSummary.findUnique({ where: { conversationId } }),
          prisma.conversationPlan.findFirst({
            where: { conversationId, isActive: true },
            orderBy: { createdAt: "desc" },
          }),
        ])
      : Promise.resolve([null, null]),
    prisma.userMemory.findMany({
      where: { userId },
      select: { key: true, content: true },
    }),
    conversationId
      ? prisma.task.findMany({
          where: { conversationId, status: "IN_PROGRESS" },
          select: { title: true, steps: true, progress: true },
        })
      : Promise.resolve([]),
    prisma.userFile.findMany({
      where: { userId },
      select: { name: true, description: true, fileType: true },
      orderBy: { updatedAt: "desc" },
      take: userFilesContextLimit,
    }),
  ]);

  if (conversationId) {
    const [summary, activePlan] = contextData as [
      { content: string } | null,
      { memory: string | null } | null,
    ];
    if (summary) existingSummary = summary.content;
    if (activePlan?.memory) planMemory = activePlan.memory;
  }

  if (userMemories.length > 0) {
    userMemoryContext = buildMemoryContext(userMemories);
  }

  let tasksContext: string | null = null;
  if (activeTasks.length > 0) {
    tasksContext = activeTasks.map((t) => {
      const steps = t.steps as Array<{ text: string; done: boolean }>;
      const done = steps.filter((s) => s.done).map((s) => `  \u2713 ${s.text}`);
      const pending = steps.filter((s) => !s.done).map((s) => `  \u25CB ${s.text}`);
      return `**${t.title}** (${t.progress}%)\n${done.join("\n")}\n${pending.join("\n")}`;
    }).join("\n\n");
  }

  // Inject user files list into system prompt
  if (userFiles.length > 0) {
    const filesList = userFiles
      .map((f) => `- ${f.name}${f.description ? ` — ${f.description}` : ""} (${f.fileType})`)
      .join("\n");
    systemPrompt += `\n\n--- USER FILES ---\nThe user has uploaded files. Use the read_knowledge tool to search in them.\n${filesList}\n--- END FILES ---`;
  }

  // ─── Autocompact ───────────────────────────────────
  const systemTokens = estimateTokens(systemPrompt);
  const effectiveContextWindow = Math.min(planContextWindowSize, textModel?.contextWindow ?? Infinity);
  const contextCheck = await checkContextWindow(messages, systemTokens, effectiveContextWindow);

  let effectiveMessages = messages;
  let isCompacting = false;

  if (contextCheck.needsCompaction) {
    const { messagesToSummarize, messagesToKeep } = await splitMessagesForCompaction(
      messages,
      keepLastMessages
    );
    if (messagesToSummarize.length > 0) {
      effectiveMessages = messagesToKeep;
      isCompacting = true;
      if (conversationId) {
        compactInBackground(conversationId, existingSummary, messagesToSummarize, planTokensPerMessage, userId, textModel);
      }
    }
  }

  // ─── Build enriched system prompt & API messages ───
  const enrichedSystemPrompt = buildSystemPromptWithContext(
    systemPrompt, existingSummary, planMemory, userMemoryContext, tasksContext
  );

  const apiMessages = buildApiMessages(effectiveMessages, attachments, enrichedSystemPrompt);

  const contextInfo = {
    usagePercent: Math.round(contextCheck.usagePercent * 100),
    totalTokens: contextCheck.totalTokens,
    contextWindowSize: contextCheck.contextWindowSize,
    compacting: isCompacting,
  };

  return {
    enrichedSystemPrompt,
    apiMessages,
    contextInfo,
    rawSystemPrompt: systemPrompt,
    effectiveMessages,
  };
}
