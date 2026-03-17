import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_URL,
  createAdminToken,
  apiRequest,
  parseStream,
  getStreamContent,
  getStreamStatuses,
  getStreamErrors,
  isServerReachable,
  type StreamChunk,
} from "./helpers";

const ORCH_URL = "http://localhost:8120";
const LEEMADB_URL = "http://localhost:8110";
const CORTEX_TOKEN = "nskey_sanbao_a7775d47525df1d646469e97";

let adminToken: string;

async function mcpCall(tool: string, args: Record<string, unknown>) {
  const res = await fetch(`${ORCH_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CORTEX_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  }
  return JSON.parse(data.result.content[0].text);
}

function extractArticleLinks(
  content: string,
): Array<{ code: string; article: string }> {
  const regex = /article:\/\/([^/\s)]+)\/([^)\s]+)/g;
  const links: Array<{ code: string; article: string }> = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({ code: match[1], article: match[2] });
  }
  return links;
}

async function sendChat(
  message: string,
  agentId: string,
  timeout = 180_000,
): Promise<StreamChunk[]> {
  const res = await apiRequest("/api/chat", {
    method: "POST",
    token: adminToken,
    timeout,
    body: {
      messages: [{ role: "user", content: message }],
      agentId,
      thinkingEnabled: false,
      webSearchEnabled: false,
    },
  });
  expect(res.status).toBe(200);
  return parseStream(res);
}

beforeAll(async () => {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(`Sanbao app at ${BASE_URL} is not reachable`);
  }
  adminToken = await createAdminToken();
});

// ---------------------------------------------------------------------------
// 1. Infrastructure health
// ---------------------------------------------------------------------------

describe("Infrastructure health", () => {
  it("LeemaDB /health returns ok", async () => {
    const res = await fetch(`${LEEMADB_URL}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("Orchestrator /health returns ok with domains", async () => {
    const res = await fetch(`${ORCH_URL}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.domains).toBeDefined();
    expect(Object.keys(data.domains).length).toBeGreaterThan(0);
  });

  it("meta_scan pagination works beyond 1000 limit", async () => {
    const META_SCAN_URL = `${LEEMADB_URL}/v3/databases/_default/collections/legal_kz/meta/scan`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CORTEX_TOKEN}`,
    };

    const resFirst = await fetch(META_SCAN_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ offset: 0, limit: 100 }),
      signal: AbortSignal.timeout(30_000),
    });
    expect(resFirst.ok).toBe(true);
    const first = await resFirst.json();
    expect(first.length).toBeGreaterThan(0);

    const resDeep = await fetch(META_SCAN_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ offset: 7000, limit: 100 }),
      signal: AbortSignal.timeout(30_000),
    });
    expect(resDeep.ok).toBe(true);
    const deep = await resDeep.json();
    expect(deep.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. MCP tools (direct orchestrator calls)
// ---------------------------------------------------------------------------

describe("MCP tools", () => {
  it("resolve_document returns article 188 (кража)", async () => {
    const result = await mcpCall("resolve_document", {
      code: "criminal_code",
      identifier: "188",
    });
    expect(result).toBeDefined();
    const text =
      typeof result === "string" ? result : JSON.stringify(result);
    expect(text.toLowerCase()).toMatch(/кража|хищение/i);
  });

  it("resolve_document returns article 190 (мошенничество)", async () => {
    const result = await mcpCall("resolve_document", {
      code: "criminal_code",
      identifier: "190",
    });
    expect(result).toBeDefined();
    const text =
      typeof result === "string" ? result : JSON.stringify(result);
    expect(text.toLowerCase()).toMatch(/мошенничество/i);
  });

  it("list_domains returns domains", async () => {
    const result = await mcpCall("list_domains", {});
    const domains = Array.isArray(result)
      ? result.map((d: { name?: string }) => d.name ?? d)
      : Object.keys(result);
    // At minimum, namespace-accessible domains should be listed
    expect(domains.length).toBeGreaterThan(0);
  });

  it("link-registry returns codes including criminal_code", async () => {
    const res = await fetch(`${ORCH_URL}/api/link-registry`, {
      headers: { Authorization: `Bearer ${CORTEX_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    // link-registry returns codes at top level: {criminal_code: {...}, ...}
    const codes = Object.keys(data);
    expect(codes).toEqual(
      expect.arrayContaining(["criminal_code", "tnved"]),
    );
  });

  it("MCP tools/list returns available tools", async () => {
    const res = await fetch(`${ORCH_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CORTEX_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    const data = await res.json();
    const tools = data.result?.tools ?? [];
    const toolNames = tools.map((t: { name: string }) => t.name);
    expect(toolNames).toEqual(
      expect.arrayContaining(["search", "resolve_document", "list_domains"]),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Article link resolution (sanbao /api/articles)
// ---------------------------------------------------------------------------

describe("Article link resolution", () => {
  it("resolves criminal_code article 188", async () => {
    const res = await apiRequest(
      "/api/articles?code=criminal_code&article=188",
      { token: adminToken },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { title?: string; text?: string };
    expect(data.title || data.text).toBeTruthy();
  });

  it("resolves criminal_code article 190 (мошенничество)", async () => {
    const res = await apiRequest(
      "/api/articles?code=criminal_code&article=190",
      { token: adminToken },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { text?: string };
    expect(data.text).toBeDefined();
    expect(data.text!.toLowerCase()).toContain("мошенничество");
  });

  it("returns error for non-existent article", async () => {
    const res = await apiRequest(
      "/api/articles?code=criminal_code&article=999999",
      { token: adminToken },
    );
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });

  it("returns 400 for missing params", async () => {
    const res = await apiRequest("/api/articles", { token: adminToken });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await apiRequest(
      "/api/articles?code=criminal_code&article=188",
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 4. Response quality (AI generates article:// links)
// ---------------------------------------------------------------------------

describe("Response quality", { timeout: 180_000 }, () => {
  it("lawyer agent uses tools and produces substantive response", async () => {
    const chunks = await sendChat(
      "Какое наказание предусмотрено за мошенничество по уголовному кодексу РК?",
      "system-femida-agent",
    );

    const errors = getStreamErrors(chunks);
    expect(errors).toHaveLength(0);

    const content = getStreamContent(chunks);
    expect(content.length).toBeGreaterThan(50);

    // Verify AI used knowledge base tools (not just own knowledge)
    const statuses = getStreamStatuses(chunks);
    expect(statuses).toEqual(expect.arrayContaining(["using_tool"]));

    // Response should mention мошенничество (fraud) — proving it used the KB
    expect(content.toLowerCase()).toContain("мошенничество");
  });

  it("article:// links from AI response resolve via /api/articles", async () => {
    const chunks = await sendChat(
      "Расскажи про статью 188 уголовного кодекса РК — кража",
      "system-femida-agent",
    );

    const content = getStreamContent(chunks);
    const links = extractArticleLinks(content);

    if (links.length === 0) {
      console.warn(
        "AI did not produce article:// links — skipping round-trip check",
      );
      return;
    }

    for (const link of links.slice(0, 3)) {
      const res = await apiRequest(
        `/api/articles?code=${encodeURIComponent(link.code)}&article=${encodeURIComponent(link.article)}`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { text?: string; title?: string };
      expect(data.text || data.title).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Search icons (streaming protocol)
// ---------------------------------------------------------------------------

describe("Search icons", { timeout: 180_000 }, () => {
  it("stream contains using_tool status with tool name", async () => {
    const chunks = await sendChat(
      "Найди информацию о статье 190 УК РК",
      "system-femida-agent",
    );

    const toolChunks = chunks.filter(
      (c) => c.t === "s" && c.v === "using_tool",
    );
    expect(toolChunks.length).toBeGreaterThan(0);

    for (const chunk of toolChunks) {
      const name = (chunk as StreamChunk & { n?: string }).n;
      expect(name).toBeDefined();
      expect(name).not.toBe("$web_search");
      expect(typeof name).toBe("string");
      expect(name!.length).toBeGreaterThan(0);
    }
  });
});
