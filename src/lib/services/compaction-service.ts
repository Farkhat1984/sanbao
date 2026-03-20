/**
 * Conversation compaction service.
 * Extracted from chat/context-loader.ts compactInBackground().
 * Handles LLM-based context summarization with Redis locking.
 */

import { prisma } from "@/lib/prisma";
import { estimateTokens } from "@/lib/context";
import { buildCompactionPrompt } from "@/lib/context";
import { resolveModel, type ResolvedModel } from "@/lib/model-router";
import { incrementTokens } from "@/lib/usage";
import { getSettingNumber } from "@/lib/settings";
import { getRedis } from "@/lib/redis";
import { DEFAULT_TEMPERATURE_COMPACTION } from "@/lib/constants";
import { logger } from "@/lib/logger";

/**
 * Run conversation compaction in the background.
 * Acquires a Redis lock to prevent parallel compactions on the same conversation.
 */
export async function compactInBackground(
  conversationId: string,
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: string; content: string }>,
  maxTokens: number,
  userId: string,
  textModel?: ResolvedModel | null,
): Promise<void> {
  const lockKey = `compact:${conversationId}`;
  try {
    // Acquire Redis lock to prevent parallel compactions
    const lockTtl = await getSettingNumber("chat_compaction_lock_ttl_s");
    const redis = getRedis();
    if (redis) {
      const acquired = await redis.set(lockKey, "1", "EX", lockTtl, "NX");
      if (!acquired) return;
    }

    const compactionPrompt = await buildCompactionPrompt(existingSummary, messagesToSummarize);

    const model = textModel || (await resolveModel("TEXT"));
    if (!model) {
      logger.error("[compact] No text model resolved from DB");
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
      logger.error(`[compaction] API error ${response.status} for conversation ${conversationId}`);
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
    logger.error("[compaction] Failed for conversation", {
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    try {
      const redis = getRedis();
      if (redis) await redis.del(lockKey);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
