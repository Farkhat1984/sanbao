import { prisma } from "@/lib/prisma";

let cachedWords: string[] | null = null;
let cachedEnabled: boolean | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function loadFilterConfig() {
  const now = Date.now();
  if (cachedWords !== null && cachedEnabled !== null && now - cacheTime < CACHE_TTL) {
    return { enabled: cachedEnabled, words: cachedWords };
  }

  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["content_filter_enabled", "content_filter_words"] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    cachedEnabled = map.content_filter_enabled === "true";
    cachedWords = map.content_filter_words
      ? map.content_filter_words
          .split(",")
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean)
      : [];
    cacheTime = now;
  } catch {
    cachedEnabled = false;
    cachedWords = [];
  }

  return { enabled: cachedEnabled, words: cachedWords };
}

/** Reset cache after admin updates settings. */
export function resetContentFilterCache() {
  cachedWords = null;
  cachedEnabled = null;
  cacheTime = 0;
}

export interface FilterResult {
  blocked: boolean;
  matched?: string[];
}

/** Check text against content filter. */
export async function checkContentFilter(text: string): Promise<FilterResult> {
  const { enabled, words } = await loadFilterConfig();
  if (!enabled || words.length === 0) {
    return { blocked: false };
  }

  const lower = text.toLowerCase();
  const matched = words.filter((w) => lower.includes(w));

  if (matched.length > 0) {
    return { blocked: true, matched };
  }

  return { blocked: false };
}
