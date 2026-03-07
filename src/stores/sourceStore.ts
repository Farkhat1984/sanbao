import { create } from "zustand";

export interface SourceChunkContext {
  chunk_index: number;
  text: string;
  heading_path: string;
  page_start?: number;
}

export interface SourceData {
  source_uri: string;
  text: string;
  source_file: string;
  chunk_index: number;
  total_chunks: number;
  heading_path: string;
  page_start?: number;
  page_end?: number;
  file_type: string;
  context_before: SourceChunkContext[];
  context_after: SourceChunkContext[];
}

interface SourceState {
  activeSource: SourceData | null;
  loading: boolean;
  error: string | null;
  cache: Map<string, SourceData>;

  openSource: (domain: string, sourceFile: string, chunkIndex: number) => Promise<void>;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  activeSource: null,
  loading: false,
  error: null,
  cache: new Map(),

  openSource: async (domain, sourceFile, chunkIndex) => {
    const key = `${domain}/${sourceFile}/${chunkIndex}`;
    const cached = get().cache.get(key);

    if (cached) {
      const newCache = new Map(get().cache);
      newCache.delete(key);
      newCache.set(key, cached);
      set({ activeSource: cached, error: null, loading: false, cache: newCache });
      return;
    }

    set({ loading: true, error: null, activeSource: null });

    try {
      const res = await fetch(
        `/api/articles?code=source&article=${encodeURIComponent(`${domain}/${sourceFile}/${chunkIndex}`)}`
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }

      const data: SourceData = await res.json();
      const newCache = new Map(get().cache);
      newCache.set(key, data);

      if (newCache.size > 30) {
        const lru = newCache.keys().next().value;
        if (lru) newCache.delete(lru);
      }

      set({ activeSource: data, loading: false, cache: newCache });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load source",
        loading: false,
      });
    }
  },
}));
