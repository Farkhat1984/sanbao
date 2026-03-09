import { create } from "zustand";
import { BoundedMap } from "@/lib/bounded-map";

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

/** Max cached sources before LRU eviction */
const SOURCE_CACHE_CAPACITY = 30;

interface SourceState {
  activeSource: SourceData | null;
  loading: boolean;
  error: string | null;
  cache: BoundedMap<string, SourceData>;

  openSource: (domain: string, sourceFile: string, chunkIndex: number) => Promise<void>;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  activeSource: null,
  loading: false,
  error: null,
  cache: new BoundedMap(SOURCE_CACHE_CAPACITY),

  openSource: async (domain, sourceFile, chunkIndex) => {
    const key = `${domain}/${sourceFile}/${chunkIndex}`;
    const cached = get().cache.get(key);

    if (cached) {
      set({ activeSource: cached, error: null, loading: false });
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
      get().cache.set(key, data);

      set({ activeSource: data, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load source",
        loading: false,
      });
    }
  },
}));
