import { describe, it, expect } from "vitest";
import { parseCursorParams, applyCursorPagination, cursorArgs } from "@/lib/pagination";

describe("parseCursorParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    const result = parseCursorParams(params);
    expect(result).toEqual({ cursor: undefined, limit: 20 });
  });

  it("parses cursor and limit from search params", () => {
    const params = new URLSearchParams({ cursor: "abc123", limit: "10" });
    const result = parseCursorParams(params);
    expect(result).toEqual({ cursor: "abc123", limit: 10 });
  });

  it("clamps limit to max 100", () => {
    const params = new URLSearchParams({ limit: "500" });
    const result = parseCursorParams(params);
    expect(result.limit).toBe(100);
  });

  it("uses default when limit is 0 or negative", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = parseCursorParams(params);
    // parseInt("0") || defaultLimit → 0 is falsy, falls back to default
    expect(result.limit).toBe(20);
  });

  it("uses custom default limit", () => {
    const params = new URLSearchParams();
    const result = parseCursorParams(params, 50);
    expect(result.limit).toBe(50);
  });

  it("handles NaN limit gracefully", () => {
    const params = new URLSearchParams({ limit: "abc" });
    const result = parseCursorParams(params);
    expect(result.limit).toBe(20);
  });
});

describe("applyCursorPagination", () => {
  const makeItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));

  it("returns all items when fewer than limit", () => {
    const items = makeItems(5);
    const result = applyCursorPagination(items, 10);
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns exactly limit items when hasMore", () => {
    const items = makeItems(11); // limit + 1
    const result = applyCursorPagination(items, 10);
    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("item-9");
  });

  it("handles empty array", () => {
    const result = applyCursorPagination([], 10);
    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("handles exactly limit items (no hasMore)", () => {
    const items = makeItems(10);
    const result = applyCursorPagination(items, 10);
    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe("cursorArgs", () => {
  it("returns take: limit + 1 without cursor", () => {
    const args = cursorArgs(undefined, 20);
    expect(args).toEqual({ take: 21 });
  });

  it("returns cursor and skip when cursor provided", () => {
    const args = cursorArgs("abc123", 20);
    expect(args).toEqual({
      take: 21,
      cursor: { id: "abc123" },
      skip: 1,
    });
  });
});
