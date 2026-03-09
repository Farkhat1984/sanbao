import type { OrgAgentContext } from "./agent-loader";
import type { ResolvedModel } from "@/lib/model-router";
import { getPrompt, interpolatePrompt } from "@/lib/prompts";
import { callMcpTool } from "@/lib/mcp-client";
import { TOOL_RESULT_MAX_CHARS, TOOL_RESULT_TAIL_CHARS, DEFAULT_MAX_TOKENS } from "@/lib/constants";
import { getSettingNumber } from "@/lib/settings";

interface ConsultOptions {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  agentContexts: OrgAgentContext[];
  orgName: string;
  inaccessibleAgents: Array<{ name: string }>;
  model: ResolvedModel;
  signal?: AbortSignal;
}

/** Truncate tool result to prevent context overflow */
function truncateToolResult(text: string): string {
  if (text.length <= TOOL_RESULT_MAX_CHARS) return text;
  return (
    text.slice(0, TOOL_RESULT_MAX_CHARS - TOOL_RESULT_TAIL_CHARS) +
    "\n...[truncated]...\n" +
    text.slice(-TOOL_RESULT_TAIL_CHARS)
  );
}

/**
 * Consult a single org agent — non-streaming LLM call with optional tool use.
 */
async function consultAgent(
  agentCtx: OrgAgentContext,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  model: ResolvedModel,
  maxToolTurns: number,
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = agentCtx.systemPrompt + agentCtx.skillPrompts.join("");

  // Build tools array for the agent's MCP tools
  const tools = agentCtx.mcpTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  // Use last 4 messages from history for context
  const recentHistory = history.slice(-4);

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: userMessage },
  ];

  // Tool call loop
  for (let turn = 0; turn < maxToolTurns; turn++) {
    const body: Record<string, unknown> = {
      model: model.modelId,
      messages,
      max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: 1,
      stream: false,
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${model.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Agent ${agentCtx.name}: API error ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error(`Agent ${agentCtx.name}: No response`);

    const msg = choice.message;

    // If no tool calls, return the content
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || "";
    }

    // Process tool calls
    messages.push(msg); // add assistant message with tool_calls
    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      const toolArgs = JSON.parse(tc.function.arguments || "{}");

      // Find matching MCP tool
      const mcpTool = agentCtx.mcpTools.find((t) => t.name === toolName);
      if (!mcpTool) {
        messages.push({
          role: "tool",
          content: `Tool "${toolName}" not found`,
          tool_call_id: tc.id,
        });
        continue;
      }

      try {
        const result = await callMcpTool(
          mcpTool.url,
          mcpTool.transport,
          mcpTool.apiKey,
          mcpTool.originalName || mcpTool.name,
          toolArgs
        );
        const resultStr = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
        messages.push({
          role: "tool",
          content: truncateToolResult(resultStr),
          tool_call_id: tc.id,
        });
      } catch (err) {
        messages.push({
          role: "tool",
          content: `Tool error: ${err instanceof Error ? err.message : "Unknown error"}`,
          tool_call_id: tc.id,
        });
      }
    }
  }

  // If we exhausted tool turns, make one final call without tools
  const finalResponse = await fetch(`${model.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.provider.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages,
      max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: 1,
      stream: false,
    }),
    signal,
  });

  if (!finalResponse.ok) {
    throw new Error(`Agent ${agentCtx.name}: Final API error ${finalResponse.status}`);
  }

  const finalData = await finalResponse.json();
  return finalData.choices?.[0]?.message?.content || "";
}

/**
 * Consult multiple agents in parallel and stream CEO synthesis.
 * Returns a ReadableStream of NDJSON chunks.
 */
export function consultAndSynthesize(options: ConsultOptions): ReadableStream<Uint8Array> {
  const { userMessage, conversationHistory, agentContexts, orgName, inaccessibleAgents, model, signal } = options;

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const [consultTimeoutMs, maxToolTurns] = await Promise.all([
          getSettingNumber("swarm_consult_timeout_ms"),
          getSettingNumber("swarm_consult_max_tool_turns"),
        ]);

        // Phase 1: Emit routing status
        controller.enqueue(encoder.encode(JSON.stringify({ t: "s", v: "routing" }) + "\n"));

        // Phase 2: Consult all agents in parallel
        const consultPromises = agentContexts.map(async (ctx) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: "s", v: "consulting", n: ctx.name }) + "\n")
          );

          const timeoutSignal = AbortSignal.timeout(consultTimeoutMs);
          const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutSignal])
            : timeoutSignal;

          try {
            const content = await consultAgent(ctx, userMessage, conversationHistory, model, maxToolTurns, combinedSignal);
            // Emit agent response as t:"a" tag
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  t: "a",
                  v: { id: ctx.agentId, name: ctx.name, content },
                }) + "\n"
              )
            );
            return { agentId: ctx.agentId, name: ctx.name, content, error: null };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  t: "a",
                  v: { id: ctx.agentId, name: ctx.name, content: `[Error: ${errorMsg}]` },
                }) + "\n"
              )
            );
            return { agentId: ctx.agentId, name: ctx.name, content: null, error: errorMsg };
          }
        });

        const results = await Promise.allSettled(consultPromises);

        // Phase 3: Synthesize with CEO prompt
        controller.enqueue(encoder.encode(JSON.stringify({ t: "s", v: "synthesizing" }) + "\n"));

        // Build agent responses text
        const agentResponsesText = results
          .map((r) => {
            if (r.status === "fulfilled") {
              const { name, content, error } = r.value;
              if (error) return `### ${name}\n[Agent unavailable: ${error}]`;
              return `### ${name}\n${content}`;
            }
            return `### [Agent unavailable]`;
          })
          .join("\n\n");

        // Build inaccessible note
        let inaccessibleNote = "";
        if (inaccessibleAgents.length > 0) {
          const names = inaccessibleAgents.map((a) => a.name).join(", ");
          inaccessibleNote = `\n\nNote: The following specialists were not consulted because the user lacks access: ${names}. Mention this gap in your synthesis.`;
        }

        const synthesizeTemplate = await getPrompt("prompt_swarm_synthesize");
        const synthesizePrompt = interpolatePrompt(synthesizeTemplate, {
          ORG_NAME: orgName,
          AGENT_RESPONSES: agentResponsesText,
          INACCESSIBLE_NOTE: inaccessibleNote,
        });

        // Stream CEO synthesis
        const synthResponse = await fetch(`${model.provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${model.provider.apiKey}`,
          },
          body: JSON.stringify({
            model: model.modelId,
            messages: [
              { role: "system", content: synthesizePrompt },
              { role: "user", content: userMessage },
            ],
            max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
            temperature: 1,
            stream: true,
          }),
          signal,
        });

        if (!synthResponse.ok || !synthResponse.body) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ t: "e", v: "Synthesis error: service unavailable" }) + "\n"
            )
          );
          controller.close();
          return;
        }

        // Parse SSE stream
        const reader = synthResponse.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const chunk = JSON.parse(payload);
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "c", v: delta.content }) + "\n")
                );
              }
            } catch {
              // skip malformed SSE chunks
            }
          }
        }

        controller.close();
      } catch (err) {
        try {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: "e", v: `Error: ${errorMsg}` }) + "\n")
          );
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });
}
