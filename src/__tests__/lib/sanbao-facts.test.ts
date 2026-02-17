import { describe, it, expect } from "vitest";
import { SANBAO_FACTS, getRandomFact } from "@/lib/sanbao-facts";

describe("sanbao-facts", () => {
  it("has at least 25 facts", () => {
    expect(SANBAO_FACTS.length).toBeGreaterThanOrEqual(25);
  });

  it("each fact has title and text", () => {
    for (const fact of SANBAO_FACTS) {
      expect(fact.title).toBeTruthy();
      expect(fact.text).toBeTruthy();
      expect(fact.title.length).toBeGreaterThan(3);
      expect(fact.text.length).toBeGreaterThan(20);
    }
  });

  it("getRandomFact returns a fact when available", () => {
    const result = getRandomFact(new Set());
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThanOrEqual(0);
    expect(result!.fact.title).toBeTruthy();
  });

  it("getRandomFact avoids shown indices", () => {
    const shown = new Set([0, 1, 2, 3, 4]);
    const result = getRandomFact(shown);
    expect(result).not.toBeNull();
    expect(shown.has(result!.index)).toBe(false);
  });

  it("getRandomFact returns null when all shown", () => {
    const allShown = new Set(SANBAO_FACTS.map((_, i) => i));
    const result = getRandomFact(allShown);
    expect(result).toBeNull();
  });

  it("facts are in Russian", () => {
    const cyrillicRegex = /[а-яА-ЯёЁ]/;
    for (const fact of SANBAO_FACTS) {
      expect(cyrillicRegex.test(fact.title)).toBe(true);
      expect(cyrillicRegex.test(fact.text)).toBe(true);
    }
  });
});
