import { prisma } from "@/lib/prisma";
import type { ModelCategory } from "@prisma/client";

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
}

// In-memory cache: category+planId -> { model, expiresAt }
const cache = new Map<string, { model: ResolvedModel; expiresAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

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

  // 1. Plan-specific default
  if (planId) {
    const planModel = await prisma.planModel.findFirst({
      where: {
        planId,
        isDefault: true,
        model: {
          category,
          isActive: true,
          provider: { isActive: true },
        },
      },
      include: { model: { include: { provider: true } } },
    });

    if (planModel) {
      resolved = toResolvedModel(planModel.model);
    }
  }

  // 2. Any plan-assigned model for this category
  if (!resolved && planId) {
    const planModel = await prisma.planModel.findFirst({
      where: {
        planId,
        model: {
          category,
          isActive: true,
          provider: { isActive: true },
        },
      },
      include: { model: { include: { provider: true } } },
    });

    if (planModel) {
      resolved = toResolvedModel(planModel.model);
    }
  }

  // 3. Global default model
  if (!resolved) {
    const model = await prisma.aiModel.findFirst({
      where: {
        category,
        isDefault: true,
        isActive: true,
        provider: { isActive: true },
      },
      include: { provider: true },
    });

    if (model) {
      resolved = toResolvedModel(model);
    }
  }

  // 4. Any active model in this category
  if (!resolved) {
    const model = await prisma.aiModel.findFirst({
      where: {
        category,
        isActive: true,
        provider: { isActive: true },
      },
      include: { provider: true },
      orderBy: { provider: { priority: "desc" } },
    });

    if (model) {
      resolved = toResolvedModel(model);
    }
  }

  // 5. Fallback to env vars
  if (!resolved) {
    resolved = getEnvFallback(category);
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

  if (models.length > 0) {
    return models.map(toResolvedModel);
  }

  // Fallback
  const fallback = getEnvFallback(category);
  return fallback ? [fallback] : [];
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
      apiKey: model.provider.apiKey,
    },
    modelId: model.modelId,
    displayName: model.displayName,
    category: model.category,
    temperature: model.temperature,
    topP: model.topP,
    maxTokens: model.maxTokens,
    contextWindow: model.contextWindow,
  };
}

function getEnvFallback(category: ModelCategory): ResolvedModel | null {
  switch (category) {
    case "TEXT":
    case "CODE": {
      const apiKey = process.env.MOONSHOT_API_KEY;
      if (!apiKey) return null;
      return {
        provider: {
          slug: "moonshot",
          baseUrl: "https://api.moonshot.ai/v1",
          apiKey,
        },
        modelId: "kimi-k2.5",
        displayName: "Kimi K2.5",
        category,
        temperature: null,
        topP: null,
        maxTokens: null,
        contextWindow: null,
      };
    }
    case "IMAGE": {
      const apiKey = process.env.DEEPINFRA_API_KEY;
      if (!apiKey) return null;
      return {
        provider: {
          slug: "deepinfra",
          baseUrl: "https://api.deepinfra.com/v1/openai",
          apiKey,
        },
        modelId: "black-forest-labs/FLUX-1-schnell",
        displayName: "Flux Schnell",
        category,
        temperature: null,
        topP: null,
        maxTokens: null,
        contextWindow: null,
      };
    }
    default:
      return null;
  }
}
