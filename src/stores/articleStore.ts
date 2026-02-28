import { create } from "zustand";

export interface ArticleData {
  code: string;        // "criminal_code"
  article: string;     // "188"
  title: string;       // "Кража"
  text: string;        // full article text
  annotation: string;  // notes/comments
}

interface ArticleState {
  activeArticle: ArticleData | null;
  loading: boolean;
  error: string | null;
  cache: Map<string, ArticleData>;
  /** Last requested code/article for retry on error */
  _lastRequest: { code: string; article: string } | null;

  openArticle: (code: string, article: string) => Promise<void>;
  retry: () => void;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  activeArticle: null,
  loading: false,
  error: null,
  cache: new Map(),
  _lastRequest: null,

  openArticle: async (code, article) => {
    const key = `${code}/${article}`;
    const cached = get().cache.get(key);

    if (cached) {
      // LRU: move accessed entry to end of Map so it's evicted last
      const newCache = new Map(get().cache);
      newCache.delete(key);
      newCache.set(key, cached);
      set({ activeArticle: cached, error: null, loading: false, cache: newCache, _lastRequest: { code, article } });
      return;
    }

    set({ loading: true, error: null, activeArticle: null, _lastRequest: { code, article } });

    try {
      const res = await fetch(
        `/api/articles?code=${encodeURIComponent(code)}&article=${encodeURIComponent(article)}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Ошибка ${res.status}`);
      }

      const data: ArticleData = await res.json();
      const newCache = new Map(get().cache);
      newCache.set(key, data);

      // LRU eviction: cap cache to 50 entries, remove least recently used (first in Map)
      if (newCache.size > 50) {
        const lru = newCache.keys().next().value;
        if (lru) newCache.delete(lru);
      }

      set({ activeArticle: data, loading: false, cache: newCache });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Не удалось загрузить статью",
        loading: false,
      });
    }
  },

  retry: () => {
    const { _lastRequest } = get();
    if (!_lastRequest) return;
    const key = `${_lastRequest.code}/${_lastRequest.article}`;
    const newCache = new Map(get().cache);
    newCache.delete(key);
    set({ cache: newCache, error: null });
    get().openArticle(_lastRequest.code, _lastRequest.article);
  },
}));
