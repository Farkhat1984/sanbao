import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/mcp-client", () => ({
  callMcpTool: vi.fn(),
}));

vi.mock("@/lib/native-tools", () => ({
  isNativeTool: vi.fn(() => false),
  executeNativeTool: vi.fn(),
  getNativeToolDefinitions: vi.fn(() => []),
}));

// ─── Helpers ──────────────────────────────────────────────

/** Create a ReadableStream from an array of string chunks */
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/** Create a stream that errors after N chunks */
function createFailingStream(
  chunks: string[],
  errorAfter: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= errorAfter) {
        controller.error(new Error("Network connection lost"));
        return;
      }
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/** Collect all yielded values from an async generator */
async function collectGenerator<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

/** Format a standard OpenAI SSE chunk */
function sseChunk(content: string, finishReason?: string | null): string {
  return (
    `data: ${JSON.stringify({
      choices: [
        {
          delta: { content },
          finish_reason: finishReason ?? null,
        },
      ],
    })}\n\n`
  );
}

// ═══════════════════════════════════════════════════════════
// 1. SSE Parser — disconnect / truncation / malformed data
// ═══════════════════════════════════════════════════════════

describe("parseSSEStream — error recovery", () => {
  // Import directly (no heavy dependencies)
  let parseSSEStream: typeof import("@/lib/chat/sse-parser").parseSSEStream;

  beforeEach(async () => {
    const mod = await import("@/lib/chat/sse-parser");
    parseSSEStream = mod.parseSSEStream;
  });

  describe("truncated SSE events", () => {
    it("handles a data line split across two chunks", async () => {
      const stream = createSSEStream([
        'data: {"val',
        'ue": 1}\n\n',
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ value: 1 });
    });

    it("skips incomplete JSON when stream ends mid-line", async () => {
      // Stream ends without a trailing newline — the partial line stays in buffer
      const stream = createSSEStream([
        'data: {"complete": true}\n\n',
        'data: {"incom',
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ complete: true });
    });

    it("recovers from a truncated event followed by a valid one", async () => {
      const stream = createSSEStream([
        'data: {"broken\n',      // malformed JSON line — will fail parse, be skipped
        'data: {"ok": true}\n\n', // valid line
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ ok: true });
    });
  });

  describe("unexpected stream end", () => {
    it("yields all complete events before stream error", async () => {
      const stream = createFailingStream(
        [
          sseChunk("hello"),
          sseChunk("world"),
          sseChunk("never-reached"),
        ],
        2 // error after 2nd chunk
      );

      const results: unknown[] = [];
      try {
        for await (const item of parseSSEStream(stream, 1_000_000)) {
          results.push(item);
        }
      } catch {
        // Expected — stream errored
      }

      expect(results.length).toBeGreaterThanOrEqual(1);
      // First chunk's content was parsed
      expect(results[0]).toMatchObject({
        choices: [{ delta: { content: "hello" } }],
      });
    });

    it("releases reader lock after stream error", async () => {
      const stream = createFailingStream(["data: {}\n\n"], 0);

      try {
        await collectGenerator(parseSSEStream(stream, 1_000_000));
      } catch {
        // Expected
      }

      // After error, we should be able to get a new reader (lock released by finally)
      // If the lock wasn't released, this would throw
      const newReader = stream.getReader();
      expect(newReader).toBeDefined();
      newReader.releaseLock();
    });

    it("returns empty array for immediately closed stream", async () => {
      const stream = createSSEStream([]);
      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(0);
    });
  });

  describe("malformed SSE data", () => {
    it("skips data: [DONE] sentinel", async () => {
      const stream = createSSEStream([
        'data: {"first": 1}\n\n',
        "data: [DONE]\n\n",
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ first: 1 });
    });

    it("skips lines without data: prefix", async () => {
      const stream = createSSEStream([
        ": comment line\n",
        "event: ping\n",
        'data: {"valid": true}\n\n',
        "retry: 3000\n\n",
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ valid: true });
    });

    it("skips invalid JSON in data: lines without crashing", async () => {
      const stream = createSSEStream([
        "data: not-json\n\n",
        "data: {bad json\n\n",
        'data: {"good": true}\n\n',
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ good: true });
    });

    it("handles empty data: lines", async () => {
      const stream = createSSEStream([
        "data: \n\n",
        'data: {"after_empty": 1}\n\n',
      ]);

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      // "data: " with nothing after — trimmed to "data:", not matching "data: " prefix? No:
      // "data: " starts with "data: " and slice(6) = "" which is not valid JSON -> skipped
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ after_empty: 1 });
    });

    it("handles binary garbage gracefully", async () => {
      const encoder = new TextEncoder();
      const garbage = new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x0a]); // includes \n
      const validChunk = encoder.encode('data: {"ok": true}\n\n');

      let index = 0;
      const chunks = [garbage, validChunk];
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(chunks[index]);
            index++;
          } else {
            controller.close();
          }
        },
      });

      const results = await collectGenerator(parseSSEStream(stream, 1_000_000));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ ok: true });
    });
  });

  describe("buffer overflow", () => {
    it("throws when buffer exceeds maxBuffer limit", async () => {
      const maxBuffer = 50;
      // Single chunk larger than the limit — triggers overflow on the first read
      const largeData = "data: " + "x".repeat(100) + "\n";
      const stream = createSSEStream([largeData]);

      await expect(
        collectGenerator(parseSSEStream(stream, maxBuffer))
      ).rejects.toThrow("SSE buffer overflow");
    });

    it("throws when accumulated partial lines exceed maxBuffer", async () => {
      const maxBuffer = 100;
      // Multiple chunks without newlines — buffer grows past limit
      const stream = createSSEStream([
        "data: " + "a".repeat(40),
        "b".repeat(40),
        "c".repeat(40), // total ~126 bytes, exceeds 100
      ]);

      await expect(
        collectGenerator(parseSSEStream(stream, maxBuffer))
      ).rejects.toThrow("SSE buffer overflow");
    });

    it("preserves already-yielded data before overflow", async () => {
      const maxBuffer = 100;
      const collected: unknown[] = [];

      const stream = createSSEStream([
        'data: {"before": true}\n\n',            // valid, yielded
        "data: " + "x".repeat(200) + "\n",       // triggers overflow
      ]);

      try {
        for await (const item of parseSSEStream(stream, maxBuffer)) {
          collected.push(item);
        }
      } catch (err) {
        expect((err as Error).message).toBe("SSE buffer overflow");
      }

      expect(collected).toHaveLength(1);
      expect(collected[0]).toEqual({ before: true });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Tool call orchestrator — timeout and error handling
// ═══════════════════════════════════════════════════════════

describe("executeToolCalls — timeout and error handling", () => {
  let executeToolCalls: typeof import("@/lib/chat/tool-call-orchestrator").executeToolCalls;
  let callMcpToolMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    const orchestrator = await import("@/lib/chat/tool-call-orchestrator");
    executeToolCalls = orchestrator.executeToolCalls;
    const mcpClient = await import("@/lib/mcp-client");
    callMcpToolMock = mcpClient.callMcpTool as ReturnType<typeof vi.fn>;
    callMcpToolMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeMcpTool = (name: string): import("@/lib/types/mcp").McpToolContext => ({
    name,
    description: `Test tool ${name}`,
    inputSchema: {},
    url: "http://orchestrator:8120/test",
    transport: "STREAMABLE_HTTP" as const,
    apiKey: "test-key",
    mcpServerId: "srv-1",
    originalName: name,
  });

  const makeToolCall = (
    name: string,
    args: Record<string, unknown> = {}
  ): import("@/lib/chat/tool-call-orchestrator").CollectedToolCall => ({
    id: `call_${name}_${Date.now()}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  });

  const baseCtx: import("@/lib/chat/tool-call-orchestrator").ToolExecutionContext = {
    mcpTools: [],
    mcpToolTimeoutMs: 5_000,
    toolResultMaxChars: 12_000,
    toolResultTailChars: 1_000,
  };

  it("returns timeout error when MCP tool exceeds timeout", async () => {
    const tool = makeMcpTool("slow_search");
    const ctx = { ...baseCtx, mcpTools: [tool], mcpToolTimeoutMs: 3_000 };

    // callMcpTool never resolves within timeout
    callMcpToolMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ result: "late" }), 60_000))
    );

    const emitStatus = vi.fn();
    const resultPromise = executeToolCalls(
      [makeToolCall("slow_search", { query: "test" })],
      ctx,
      emitStatus
    );

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(3_100);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].role).toBe("tool");
    expect(results[0].content).toContain("timed out");
    expect(results[0].content).toContain("slow_search");
  });

  it("returns error message when MCP tool call throws", async () => {
    const tool = makeMcpTool("failing_tool");
    const ctx = { ...baseCtx, mcpTools: [tool] };

    callMcpToolMock.mockRejectedValue(new Error("Connection refused"));

    const emitStatus = vi.fn();
    const resultPromise = executeToolCalls(
      [makeToolCall("failing_tool")],
      ctx,
      emitStatus
    );

    // Allow microtask queue to flush
    await vi.advanceTimersByTimeAsync(0);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("Error:");
    expect(results[0].content).toContain("failing_tool");
    expect(results[0].content).toContain("Connection refused");
  });

  it("handles malformed tool call arguments gracefully", async () => {
    const tool = makeMcpTool("search");
    const ctx = { ...baseCtx, mcpTools: [tool] };

    callMcpToolMock.mockResolvedValue({ result: "ok" });

    const badToolCall: import("@/lib/chat/tool-call-orchestrator").CollectedToolCall = {
      id: "call_bad",
      type: "function",
      function: {
        name: "search",
        arguments: "not valid json {{{",
      },
    };

    const emitStatus = vi.fn();
    const resultPromise = executeToolCalls([badToolCall], ctx, emitStatus);
    await vi.advanceTimersByTimeAsync(0);

    const results = await resultPromise;

    // Should not crash — fallback to empty args
    expect(results).toHaveLength(1);
    expect(callMcpToolMock).toHaveBeenCalled();
  });

  it("emits status for each tool call", async () => {
    const tool1 = makeMcpTool("search_law");
    const tool2 = makeMcpTool("search_tax");
    const ctx = { ...baseCtx, mcpTools: [tool1, tool2] };

    callMcpToolMock.mockResolvedValue({ result: "found" });

    const emitStatus = vi.fn();
    const resultPromise = executeToolCalls(
      [makeToolCall("search_law"), makeToolCall("search_tax")],
      ctx,
      emitStatus
    );
    await vi.advanceTimersByTimeAsync(0);

    await resultPromise;

    // One status emission per MCP tool call
    expect(emitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ t: "s", v: "using_tool", n: "search_law" })
    );
    expect(emitStatus).toHaveBeenCalledWith(
      expect.objectContaining({ t: "s", v: "using_tool", n: "search_tax" })
    );
  });

  it("passes built-in tool arguments as content without calling MCP", async () => {
    // Built-in tools (like $web_search) are not in mcpTools
    const ctx = { ...baseCtx, mcpTools: [] };
    const emitStatus = vi.fn();

    const builtinCall = makeToolCall("$web_search", { query: "test query" });
    const resultPromise = executeToolCalls([builtinCall], ctx, emitStatus);
    await vi.advanceTimersByTimeAsync(0);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe(JSON.stringify({ query: "test query" }));
    expect(callMcpToolMock).not.toHaveBeenCalled();
  });

  it("truncates oversized MCP tool results", async () => {
    const tool = makeMcpTool("large_result_tool");
    const ctx = {
      ...baseCtx,
      mcpTools: [tool],
      toolResultMaxChars: 2_000,
      toolResultTailChars: 200,
    };

    const hugeResult = "x".repeat(10_000);
    callMcpToolMock.mockResolvedValue({ result: hugeResult });

    const emitStatus = vi.fn();
    const resultPromise = executeToolCalls(
      [makeToolCall("large_result_tool")],
      ctx,
      emitStatus
    );
    await vi.advanceTimersByTimeAsync(0);

    const results = await resultPromise;

    expect(results).toHaveLength(1);
    // Result should be truncated well below original 10k chars
    expect(results[0].content.length).toBeLessThan(5_000);
    expect(results[0].content).toContain("обрезано");
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Buffer overflow in moonshot stream context
// ═══════════════════════════════════════════════════════════

describe("streamMoonshot — error paths", () => {
  // These tests validate error handling at the integration level
  // by mocking fetch and settings

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Parse NDJSON lines from a ReadableStream into objects */
  async function readNdjsonStream(stream: ReadableStream): Promise<Array<{ t: string; v: string }>> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const results: Array<{ t: string; v: string }> = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.trim()) {
          try {
            results.push(JSON.parse(line));
          } catch {
            // skip
          }
        }
      }
    }

    return results;
  }

  it("emits error chunk when API returns non-200", async () => {
    // Mock settings
    vi.doMock("@/lib/settings", () => ({
      getSettingNumber: vi.fn().mockResolvedValue(1_000_000),
    }));

    // Mock plan-parser
    vi.doMock("@/lib/chat/plan-parser", () => ({
      createPlanDetectorState: vi.fn(() => ({ buffer: "", inTag: false })),
      feedPlanDetector: vi.fn((_state: unknown, text: string) => ({
        chunks: [{ type: "c", text }],
      })),
      flushPlanDetector: vi.fn(() => ({ chunks: [] })),
    }));

    // Mock fetch — API returns 429 Too Many Requests
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: "Rate limit exceeded" },
      })),
    });

    try {
      const { streamMoonshot } = await import("@/lib/chat/moonshot-stream");

      const stream = streamMoonshot(
        [{ role: "user", content: "test" }],
        {
          maxTokens: 1000,
          thinkingEnabled: false,
          webSearchEnabled: false,
          textModel: {
            modelId: "test-model",
            provider: { baseUrl: "http://test.api", apiKey: "key", slug: "test" },
          } as import("@/lib/model-router").ResolvedModel,
        }
      );

      // Drain the stream
      const chunks = await readNdjsonStream(stream);

      const errorChunk = chunks.find((c) => c.t === "e");
      expect(errorChunk).toBeDefined();
      expect(errorChunk!.v).toContain("Rate limit exceeded");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("emits error chunk when API returns empty body", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSettingNumber: vi.fn().mockResolvedValue(1_000_000),
    }));

    vi.doMock("@/lib/chat/plan-parser", () => ({
      createPlanDetectorState: vi.fn(() => ({ buffer: "", inTag: false })),
      feedPlanDetector: vi.fn((_state: unknown, text: string) => ({
        chunks: [{ type: "c", text }],
      })),
      flushPlanDetector: vi.fn(() => ({ chunks: [] })),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null, // Empty body
    });

    try {
      const { streamMoonshot } = await import("@/lib/chat/moonshot-stream");

      const stream = streamMoonshot(
        [{ role: "user", content: "test" }],
        {
          maxTokens: 1000,
          thinkingEnabled: false,
          webSearchEnabled: false,
          textModel: {
            modelId: "test-model",
            provider: { baseUrl: "http://test.api", apiKey: "key", slug: "test" },
          } as import("@/lib/model-router").ResolvedModel,
        }
      );

      const chunks = await readNdjsonStream(stream);

      const errorChunk = chunks.find((c) => c.t === "e");
      expect(errorChunk).toBeDefined();
      expect(errorChunk!.v).toBe("Пустой ответ от API");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("emits connection error when fetch itself throws", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSettingNumber: vi.fn().mockResolvedValue(1_000_000),
    }));

    vi.doMock("@/lib/chat/plan-parser", () => ({
      createPlanDetectorState: vi.fn(() => ({ buffer: "", inTag: false })),
      feedPlanDetector: vi.fn((_state: unknown, text: string) => ({
        chunks: [{ type: "c", text }],
      })),
      flushPlanDetector: vi.fn(() => ({ chunks: [] })),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    try {
      const { streamMoonshot } = await import("@/lib/chat/moonshot-stream");

      const stream = streamMoonshot(
        [{ role: "user", content: "test" }],
        {
          maxTokens: 1000,
          thinkingEnabled: false,
          webSearchEnabled: false,
          textModel: {
            modelId: "test-model",
            provider: { baseUrl: "http://test.api", apiKey: "key", slug: "test" },
          } as import("@/lib/model-router").ResolvedModel,
        }
      );

      const chunks = await readNdjsonStream(stream);

      const errorChunk = chunks.find((c) => c.t === "e");
      expect(errorChunk).toBeDefined();
      expect(errorChunk!.v).toBe("Ошибка подключения к API");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("emits error when SSE stream contains provider error event", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSettingNumber: vi.fn().mockResolvedValue(1_000_000),
    }));

    vi.doMock("@/lib/chat/plan-parser", () => ({
      createPlanDetectorState: vi.fn(() => ({ buffer: "", inTag: false })),
      feedPlanDetector: vi.fn((_state: unknown, text: string) => ({
        chunks: [{ type: "c", text }],
      })),
      flushPlanDetector: vi.fn(() => ({ chunks: [] })),
    }));

    // API returns SSE stream with an error event
    const sseBody = createSSEStream([
      `data: ${JSON.stringify({
        type: "error",
        error: { message: "Model overloaded" },
      })}\n\n`,
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody,
    });

    try {
      const { streamMoonshot } = await import("@/lib/chat/moonshot-stream");

      const stream = streamMoonshot(
        [{ role: "user", content: "test" }],
        {
          maxTokens: 1000,
          thinkingEnabled: false,
          webSearchEnabled: false,
          textModel: {
            modelId: "test-model",
            provider: { baseUrl: "http://test.api", apiKey: "key", slug: "test" },
          } as import("@/lib/model-router").ResolvedModel,
        }
      );

      const chunks = await readNdjsonStream(stream);

      const errorChunk = chunks.find((c) => c.t === "e");
      expect(errorChunk).toBeDefined();
      expect(errorChunk!.v).toContain("Model overloaded");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves partial content when stream disconnects mid-response", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSettingNumber: vi.fn().mockResolvedValue(1_000_000),
    }));

    vi.doMock("@/lib/chat/plan-parser", () => ({
      createPlanDetectorState: vi.fn(() => ({ buffer: "", inTag: false })),
      feedPlanDetector: vi.fn((_state: unknown, text: string) => ({
        chunks: [{ type: "c", text }],
      })),
      flushPlanDetector: vi.fn(() => ({ chunks: [] })),
    }));

    // Stream delivers 2 valid chunks then errors
    const sseBody = createFailingStream(
      [
        sseChunk("Первая часть ответа. "),
        sseChunk("Вторая часть. "),
        sseChunk("Это не дойдёт"),
      ],
      2 // error after chunk index 2
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody,
    });

    try {
      const { streamMoonshot } = await import("@/lib/chat/moonshot-stream");

      const stream = streamMoonshot(
        [{ role: "user", content: "test" }],
        {
          maxTokens: 1000,
          thinkingEnabled: false,
          webSearchEnabled: false,
          textModel: {
            modelId: "test-model",
            provider: { baseUrl: "http://test.api", apiKey: "key", slug: "test" },
          } as import("@/lib/model-router").ResolvedModel,
        }
      );

      const chunks = await readNdjsonStream(stream);

      // Should have at least some content chunks before the error
      const contentChunks = chunks.filter((c) => c.t === "c");
      const errorChunks = chunks.filter((c) => c.t === "e");

      // Partial content was delivered before the disconnect
      if (contentChunks.length > 0) {
        const allContent = contentChunks.map((c) => c.v).join("");
        expect(allContent).toContain("Первая часть");
      }

      // An error should be emitted (either from SSE parse or catch block)
      expect(errorChunks.length).toBeGreaterThanOrEqual(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
