import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import type { ResolvedModel } from "@/lib/model-router";
import { DEFAULT_MAX_TOKENS } from "@/lib/constants";
import { getSettingNumber } from "@/lib/settings";

export interface ClassifyResult {
  mode: "single" | "multi";
  agentIds: string[];
}

/**
 * Classify a user message to determine which org agent(s) should handle it.
 * Uses a non-streaming LLM call with the swarm classify prompt.
 */
export async function classifySwarmRequest(
  userMessage: string,
  agents: Array<{ id: string; name: string; description: string | null }>,
  model: ResolvedModel
): Promise<ClassifyResult> {
  // Shortcut: 0 or 1 agent — no need for LLM
  if (agents.length === 0) return { mode: "single", agentIds: [] };
  if (agents.length === 1) return { mode: "single", agentIds: [agents[0].id] };

  try {
    const agentsText = agents
      .map((a) => `- id: "${a.id}", name: "${a.name}", description: "${a.description || "N/A"}"`)
      .join("\n");

    const [promptTemplate, classifyTimeout] = await Promise.all([
      getPrompt("prompt_swarm_classify"),
      getSettingNumber("swarm_classify_timeout_ms"),
    ]);
    const systemPrompt = interpolatePrompt(promptTemplate, { AGENTS: agentsText });

    const response = await fetch(`${model.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
        temperature: 1,
        stream: false,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(classifyTimeout),
    });

    if (!response.ok) {
      console.error(`[swarm-classify] API error ${response.status}`);
      return { mode: "single", agentIds: [agents[0].id] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { mode: "single", agentIds: [agents[0].id] };
    }

    // Parse JSON — handle potential markdown code fences
    const jsonStr = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    // Validate response shape
    if (!parsed || typeof parsed.mode !== "string" || !Array.isArray(parsed.agentIds)) {
      return { mode: "single", agentIds: [agents[0].id] };
    }

    // Filter to valid agent IDs only
    const validIds = new Set(agents.map((a) => a.id));
    const filteredIds = parsed.agentIds.filter((id: string) => validIds.has(id));

    if (filteredIds.length === 0) {
      return { mode: "single", agentIds: [] }; // general question
    }

    // Cap multi mode at 4 agents
    if (parsed.mode === "multi" && filteredIds.length > 4) {
      filteredIds.length = 4;
    }

    // If "multi" with only 1 agent, convert to single
    if (parsed.mode === "multi" && filteredIds.length === 1) {
      return { mode: "single", agentIds: filteredIds };
    }

    return {
      mode: parsed.mode === "multi" ? "multi" : "single",
      agentIds: filteredIds,
    };
  } catch (err) {
    console.error("[swarm-classify] Error:", err instanceof Error ? err.message : err);
    return { mode: "single", agentIds: [agents[0].id] };
  }
}
