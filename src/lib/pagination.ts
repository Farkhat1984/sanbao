/**
 * Unified pagination utilities for both cursor-based and offset-based pagination.
 * Replaces 3 different ad-hoc implementations (pop, slice, parsePagination).
 */

/** Parse cursor-based pagination params from URL search params */
export function parseCursorParams(searchParams: URLSearchParams, defaultLimit = 20) {
  const cursor = searchParams.get("cursor") || undefined;
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10) || defaultLimit),
    100,
  );
  return { cursor, limit };
}

/**
 * Apply cursor pagination to a list fetched with `take: limit + 1`.
 * Returns the trimmed items, hasMore flag, and nextCursor.
 */
export function applyCursorPagination<T extends { id: string }>(
  items: T[],
  limit: number,
): { items: T[]; hasMore: boolean; nextCursor: string | null } {
  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && trimmed.length > 0
    ? trimmed[trimmed.length - 1].id
    : null;
  return { items: trimmed, hasMore, nextCursor };
}

/**
 * Build Prisma cursor args for findMany.
 * Usage: `prisma.model.findMany({ ...cursorArgs(cursor, limit), where, orderBy })`
 */
export function cursorArgs(cursor: string | undefined, limit: number) {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}
