import { create } from "zustand";
import { BoundedMap } from "@/lib/bounded-map";

export interface ArticleData {
  code: string;        // "criminal_code"
  article: string;     // "188"
  title: string;       // "Кража"
  text: string;        // full article text
  annotation: string;  // notes/comments
}

/** Max cached articles before LRU eviction */
const ARTICLE_CACHE_CAPACITY = 50;

interface ArticleState {
  activeArticle: ArticleData | null;
  loading: boolean;
  error: string | null;
  cache: BoundedMap<string, ArticleData>;
  /** Last requested code/article for retry on error */
  _lastRequest: { code: string; article: string } | null;

  openArticle: (code: string, article: string) => Promise<void>;
  retry: () => void;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  activeArticle: null,
  loading: false,
  error: null,
  cache: new BoundedMap(ARTICLE_CACHE_CAPACITY),
  _lastRequest: null,

  openArticle: async (code, article) => {
    const key = `${code}/${article}`;
    const cached = get().cache.get(key);

    if (cached) {
      set({ activeArticle: cached, error: null, loading: false, _lastRequest: { code, article } });
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
      get().cache.set(key, data);

      set({ activeArticle: data, loading: false });
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
    get().cache.delete(key);
    set({ error: null });
    get().openArticle(_lastRequest.code, _lastRequest.article);
  },
}));
