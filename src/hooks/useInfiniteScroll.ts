"use client";

import { useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
  /** Callback to load the next page */
  onLoadMore: () => void;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether a load is currently in progress (prevents duplicate triggers) */
  loading?: boolean;
  /**
   * Distance in pixels before the sentinel enters the viewport to trigger loading.
   * Passed as IntersectionObserver rootMargin. Default: "200px".
   */
  rootMargin?: string;
  /**
   * IntersectionObserver threshold (0-1). Default: 0 (any intersection triggers).
   */
  threshold?: number;
}

/**
 * Hook that returns a ref to attach to a sentinel element for infinite scroll.
 * Triggers `onLoadMore` when the sentinel becomes visible in the viewport.
 *
 * @example
 * ```tsx
 * const sentinelRef = useInfiniteScroll({
 *   onLoadMore: loadMore,
 *   hasMore,
 *   loading: loadingMore,
 * });
 * // ...
 * <div ref={sentinelRef} />
 * ```
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading = false,
  rootMargin = "200px",
  threshold = 0,
}: UseInfiniteScrollOptions): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, rootMargin, threshold]);

  return sentinelRef;
}
