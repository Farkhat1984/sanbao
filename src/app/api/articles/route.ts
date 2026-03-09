import { NextRequest } from "next/server";
import { callMcpTool } from "@/lib/mcp-client";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

const UNIFIED_MCP_URL =
  process.env.UNIFIED_MCP_URL || "http://orchestrator:8120/mcp";
const CORTEX_TOKEN = process.env.AI_CORTEX_AUTH_TOKEN || null;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ('error' in authResult) return authResult.error;
  const { userId } = authResult.auth;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const article = searchParams.get("article");

  if (!code || !article) {
    return jsonError("Missing code or article parameter", 400);
  }

  const ctx = { userId };

  // source:// protocol — resolve via get_source tool
  if (code === "source") {
    // article = "domain/file.pdf/chunk_index"
    const parts = article.split("/");
    if (parts.length < 3) {
      return jsonError("Invalid source URI format", 400);
    }
    const domain = parts[0];
    const chunkIndex = parseInt(parts[parts.length - 1], 10);
    const sourceFile = parts.slice(1, -1).join("/");

    if (!domain || !sourceFile || isNaN(chunkIndex)) {
      return jsonError("Invalid source URI components", 400);
    }

    const { result: srcResult, error: srcError } = await callMcpTool(
      UNIFIED_MCP_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
      "get_source", { source_file: sourceFile, chunk_index: chunkIndex, domain }, ctx,
    );
    if (srcError) return jsonError(`MCP error: ${srcError}`, 502);

    try {
      const parsed = JSON.parse(srcResult);
      if (parsed.error) {
        return jsonError(parsed.error, 404);
      }
      return jsonOk(parsed);
    } catch {
      return jsonOk({ text: srcResult, source_file: sourceFile, chunk_index: chunkIndex });
    }
  }

  // Single unified call — orchestrator resolves the right handler
  const { result, error } = await callMcpTool(
    UNIFIED_MCP_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
    "resolve_document", { code, identifier: article }, ctx,
  );
  if (error) return jsonError(`MCP error: ${error}`, 502);

  return parseResponse(code, article, result);
}

// ─── Unified response parser ─────────────────────────────────

function parseResponse(code: string, article: string, result: string) {
  try {
    const parsed = JSON.parse(result);

    if (parsed.error) {
      return jsonOk(
        { error: parsed.error, code, article },
        404,
      );
    }

    return jsonOk({
      code,
      article,
      title: parsed.title || parsed.type_name || parsed.product_key || "",
      text: parsed.full_text || parsed.text || parsed.content || result,
      annotation: parsed.annotation || parsed.note || parsed.status || "",
    });
  } catch {
    return jsonOk({
      code, article,
      title: article,
      text: result,
      annotation: "",
    });
  }
}
