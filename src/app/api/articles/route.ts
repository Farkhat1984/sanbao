import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callMcpTool } from "@/lib/mcp-client";

const UNIFIED_MCP_URL =
  process.env.UNIFIED_MCP_URL || "http://orchestrator:8120/mcp";
const CORTEX_TOKEN = process.env.AI_CORTEX_AUTH_TOKEN || null;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const article = searchParams.get("article");

  if (!code || !article) {
    return NextResponse.json(
      { error: "Missing code or article parameter" },
      { status: 400 }
    );
  }

  const ctx = { userId: session.user.id };

  // Single unified call — orchestrator resolves the right handler
  const { result, error } = await callMcpTool(
    UNIFIED_MCP_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
    "resolve_document", { code, identifier: article }, ctx,
  );
  if (error) return NextResponse.json({ error: `MCP error: ${error}` }, { status: 502 });

  return parseResponse(code, article, result);
}

// ─── Unified response parser ─────────────────────────────────

function parseResponse(code: string, article: string, result: string) {
  try {
    const parsed = JSON.parse(result);

    if (parsed.error) {
      return NextResponse.json(
        { error: parsed.error, code, article },
        { status: 404 },
      );
    }

    // Build adilet URL for law documents
    const adiletUrl = code === "law"
      ? (parsed.url || `https://adilet.zan.kz/rus/docs/${article}`)
      : undefined;

    return NextResponse.json({
      code,
      article,
      title: parsed.title || parsed.type_name || parsed.product_key || "",
      text: parsed.full_text || parsed.text || parsed.content || result,
      annotation: parsed.annotation || parsed.note || parsed.status || "",
      ...(adiletUrl ? { adiletUrl } : {}),
    });
  } catch {
    return NextResponse.json({
      code, article,
      title: article,
      text: result,
      annotation: "",
    });
  }
}
