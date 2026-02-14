import { prisma } from "@/lib/prisma";

interface ActiveExperiment {
  id: string;
  key: string;
  variantA: string;
  variantB: string;
  trafficPct: number;
}

let cache: { experiments: ActiveExperiment[]; expiresAt: number } | null = null;
const CACHE_TTL = 60_000;

async function loadExperiments(): Promise<ActiveExperiment[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.experiments;

  const experiments = await prisma.promptExperiment.findMany({
    where: { isActive: true },
    select: { id: true, key: true, variantA: true, variantB: true, trafficPct: true },
  });

  cache = { experiments, expiresAt: Date.now() + CACHE_TTL };
  return experiments;
}

export function invalidateExperimentCache() {
  cache = null;
}

/**
 * Resolve prompt value considering active A/B experiments.
 * Uses userId hash for consistent assignment.
 *
 * Returns { value, experimentId?, variant? } so the caller can track impressions.
 */
export async function resolveWithExperiment(
  key: string,
  defaultValue: string,
  userId: string
): Promise<{ value: string; experimentId?: string; variant?: "A" | "B" }> {
  try {
    const experiments = await loadExperiments();
    const experiment = experiments.find((e) => e.key === key);

    if (!experiment) return { value: defaultValue };

    // Consistent hash: use userId to deterministically assign variant
    const hash = simpleHash(userId + experiment.id);
    const inBucket = (hash % 100) < experiment.trafficPct;

    if (inBucket) {
      // Track impression (fire-and-forget)
      prisma.promptExperiment
        .update({ where: { id: experiment.id }, data: { impressionsB: { increment: 1 } } })
        .catch(() => {});
      return { value: experiment.variantB, experimentId: experiment.id, variant: "B" };
    }

    prisma.promptExperiment
      .update({ where: { id: experiment.id }, data: { impressionsA: { increment: 1 } } })
      .catch(() => {});
    return { value: experiment.variantA, experimentId: experiment.id, variant: "A" };
  } catch {
    return { value: defaultValue };
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
