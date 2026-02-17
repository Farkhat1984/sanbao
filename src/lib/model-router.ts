import { prisma } from "@/lib/prisma";
import type { ModelCategory } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import { CACHE_TTL as CONSTANTS_CACHE_TTL } from "@/lib/constants";
import { BoundedMap } from "@/lib/bounded-map";

export interface ResolvedModel {
  provider: {
    slug: string;
    baseUrl: string;
    apiKey: string;
  };
  modelId: string;
  displayName: string;
  category: ModelCategory;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  contextWindow: number | null;
  supportsThinking: boolean;
  maxThinkingTokens: number | null;
}

// In-memory cache: category+planId -> { model, expiresAt }
const cache = new BoundedMap<string, { model: ResolvedModel; expiresAt: number }>(200);
const CACHE_TTL = CONSTANTS_CACHE_TTL;

function cacheKey(category: ModelCategory, planId?: string) {
  return `${category}:${planId || "default"}`;
}

/**
 * Resolve which AI model to use for a given category and user plan.
 *
 * Priority:
 * 1. Plan-specific default model (PlanModel with isDefault)
 * 2. Any plan-assigned model for this category
 * 3. Global default model (AiModel with isDefault + category)
 * 4. Any active model in this category (ordered by provider priority)
 * 5. Fallback to hardcoded env vars (backward compatibility)
 */
export async function resolveModel(
  category: ModelCategory,
  planId?: string
): Promise<ResolvedModel | null> {
  const key = cacheKey(category, planId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.model;
  }

  let resolved: ResolvedModel | null = null;

  // Single query: fetch all active models in this category, then resolve by priority
  const allModels = await prisma.aiModel.findMany({
    where: {
      category,
      isActive: true,
      provider: { isActive: true },
    },
    include: {
      provider: true,
      planModels: planId ? { where: { planId } } : false,
    },
    orderBy: [{ isDefault: "desc" }, { provider: { priority: "desc" } }],
  });

  if (allModels.length > 0) {
    // Priority: plan-default → plan-any → global-default → any active
    type ModelRow = (typeof allModels)[number];
    const planModelsArr = planId ? allModels.filter((m) => (m as ModelRow & { planModels?: unknown[] }).planModels?.length) : [];
    const planDefault = planModelsArr.find((m) => {
      const pm = (m as ModelRow & { planModels?: { isDefault: boolean }[] }).planModels;
      return pm?.some((p) => p.isDefault);
    });
    const planAny = planModelsArr[0];
    const globalDefault = allModels.find((m) => m.isDefault);
    const anyActive = allModels[0];

    const pick = planDefault || planAny || globalDefault || anyActive;
    if (pick) resolved = toResolvedModel(pick);
  }

  if (resolved) {
    cache.set(key, { model: resolved, expiresAt: Date.now() + CACHE_TTL });
  }

  return resolved;
}

/**
 * Get all available models for a category (for fallback chains).
 */
export async function getModelsForCategory(
  category: ModelCategory,
  planId?: string
): Promise<ResolvedModel[]> {
  const where = planId
    ? {
        planModels: { some: { planId } },
        category,
        isActive: true,
        provider: { isActive: true },
      }
    : {
        category,
        isActive: true,
        provider: { isActive: true },
      };

  const models = await prisma.aiModel.findMany({
    where,
    include: { provider: true },
    orderBy: [{ isDefault: "desc" }, { provider: { priority: "desc" } }],
  });

  return models.map(toResolvedModel);
}

/** Invalidate cache (call after admin changes providers/models). */
export function invalidateModelCache() {
  cache.clear();
}

// ─── Internal helpers ───────────────────────────────────

type ModelWithProvider = {
  modelId: string;
  displayName: string;
  category: ModelCategory;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  contextWindow: number | null;
  supportsThinking: boolean;
  maxThinkingTokens: number | null;
  provider: {
    slug: string;
    baseUrl: string;
    apiKey: string;
  };
};

function toResolvedModel(model: ModelWithProvider): ResolvedModel {
  return {
    provider: {
      slug: model.provider.slug,
      baseUrl: model.provider.baseUrl,
      apiKey: decrypt(model.provider.apiKey),
    },
    modelId: model.modelId,
    displayName: model.displayName,
    category: model.category,
    temperature: model.temperature,
    topP: model.topP,
    maxTokens: model.maxTokens,
    contextWindow: model.contextWindow,
    supportsThinking: model.supportsThinking ?? false,
    maxThinkingTokens: model.maxThinkingTokens ?? null,
  };
}

