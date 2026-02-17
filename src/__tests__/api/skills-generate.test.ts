import { describe, it, expect } from "vitest";

/**
 * Test JSON extraction logic used in /api/skills/generate
 * Extracted as a pure function for testability
 */
function extractJsonFromResponse(content: string): string {
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start >= 0 && end > start) {
      jsonStr = jsonStr.slice(start, end + 1);
    }
  }
  return jsonStr;
}

describe("skills/generate JSON extraction", () => {
  const validJson = {
    name: "Юрист по ГК РФ",
    description: "Специалист по гражданскому праву",
    systemPrompt: "Ты — юрист...",
    citationRules: "Ссылайся на статьи ГК РФ",
    jurisdiction: "RU",
    icon: "Scale",
    iconColor: "#3B82F6",
  };

  it("parses JSON wrapped in ```json code block", () => {
    const response = "```json\n" + JSON.stringify(validJson) + "\n```";
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("parses JSON wrapped in ``` code block without json tag", () => {
    const response = "```\n" + JSON.stringify(validJson) + "\n```";
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("parses raw JSON without code block", () => {
    const response = JSON.stringify(validJson);
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("parses JSON with leading text (fallback extraction)", () => {
    const response = "Вот результат:\n" + JSON.stringify(validJson);
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("parses JSON with leading and trailing text", () => {
    const response = "Конечно! Вот JSON:\n" + JSON.stringify(validJson) + "\n\nНадеюсь помог!";
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("handles JSON with extra whitespace", () => {
    const response = "  \n  " + JSON.stringify(validJson, null, 2) + "  \n  ";
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("Юрист по ГК РФ");
  });

  it("prefers markdown code block over raw JSON", () => {
    const innerJson = { ...validJson, name: "From code block" };
    const response = "Some text { broken\n```json\n" + JSON.stringify(innerJson) + "\n```";
    const result = JSON.parse(extractJsonFromResponse(response));
    expect(result.name).toBe("From code block");
  });

  it("throws on completely invalid content", () => {
    const response = "I cannot generate this skill because...";
    expect(() => JSON.parse(extractJsonFromResponse(response))).toThrow();
  });
});
