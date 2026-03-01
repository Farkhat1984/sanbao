import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callMcpTool } from "@/lib/mcp-client";

const LAWYER_URL =
  process.env.LAWYER_MCP_URL || "http://orchestrator:8120/lawyer";
const CONSULTANT_1C_URL =
  process.env.CONSULTANT_1C_MCP_URL || "http://orchestrator:8120/consultant_1c";
const ACCOUNTANT_URL =
  process.env.ACCOUNTINGDB_MCP_URL || "http://orchestrator:8120/accountant";
const CORTEX_TOKEN = process.env.AI_CORTEX_AUTH_TOKEN || null;

const LEGAL_CODES = new Set([
  "constitution", "criminal_code", "criminal_procedure",
  "civil_code_general", "civil_code_special", "civil_procedure",
  "admin_offenses", "admin_procedure", "tax_code",
  "labor_code", "land_code", "ecological_code",
  "entrepreneurship", "budget_code", "customs_code",
  "family_code", "social_code", "water_code",
]);

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

  // ─── Route by code type ────────────────────────────────────

  // Legal codes (18 кодексов) → /lawyer get_article
  if (LEGAL_CODES.has(code)) {
    const { result, error } = await callMcpTool(
      LAWYER_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
      "get_article", { code, article }, ctx,
    );
    if (error) return NextResponse.json({ error: `MCP error: ${error}` }, { status: 502 });
    return parseArticleResponse(code, article, result);
  }

  // Laws/НПА → /lawyer get_law (by doc_code)
  if (code === "law") {
    const { result, error } = await callMcpTool(
      LAWYER_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
      "get_law", { doc_code: article }, ctx,
    );
    if (error) return NextResponse.json({ error: `MCP error: ${error}` }, { status: 502 });
    return parseLawResponse(article, result);
  }

  // 1С Platform → /consultant_1c get_1c_article
  if (code === "1c") {
    const { result, error } = await callMcpTool(
      CONSULTANT_1C_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
      "get_1c_article", { article_id: article }, ctx,
    );
    if (error) return NextResponse.json({ error: `MCP error: ${error}` }, { status: 502 });
    return parse1cResponse(code, article, result);
  }

  // 1С Accounting → /accountant get_1c_article
  if (code === "1c_buh") {
    const { result, error } = await callMcpTool(
      ACCOUNTANT_URL, "STREAMABLE_HTTP", CORTEX_TOKEN,
      "get_1c_article", { article_id: article }, ctx,
    );
    if (error) return NextResponse.json({ error: `MCP error: ${error}` }, { status: 502 });
    return parse1cResponse(code, article, result);
  }

  return NextResponse.json({ error: `Unknown code: ${code}` }, { status: 400 });
}

// ─── Response parsers ───────────────────────────────────────

function parseArticleResponse(code: string, article: string, result: string) {
  try {
    const parsed = JSON.parse(result);

    // Detect error response from MCP
    if (parsed.error) {
      return NextResponse.json(
        { error: parsed.error, code, article },
        { status: 404 },
      );
    }

    return NextResponse.json({
      code,
      article,
      title: parsed.title || "",
      text: parsed.text || parsed.content || result,
      annotation: parsed.annotation || parsed.note || "",
    });
  } catch {
    return NextResponse.json({
      code, article,
      title: `Статья ${article}`,
      text: result,
      annotation: "",
    });
  }
}

function buildAdiletUrl(docCode: string): string {
  return `https://adilet.zan.kz/rus/docs/${docCode}`;
}

function parseLawResponse(docCode: string, result: string) {
  try {
    const parsed = JSON.parse(result);

    // Detect error response from MCP
    if (parsed.error) {
      return NextResponse.json(
        { error: parsed.error, code: "law", article: docCode, adiletUrl: buildAdiletUrl(docCode) },
        { status: 404 },
      );
    }

    return NextResponse.json({
      code: "law",
      article: docCode,
      title: parsed.title || parsed.type_name || "",
      text: parsed.full_text || parsed.text || result,
      annotation: parsed.note || parsed.status || "",
      adiletUrl: parsed.url || buildAdiletUrl(docCode),
    });
  } catch {
    return NextResponse.json({
      code: "law", article: docCode,
      title: docCode,
      text: result,
      annotation: "",
      adiletUrl: buildAdiletUrl(docCode),
    });
  }
}

function parse1cResponse(code: string, articleId: string, result: string) {
  try {
    const parsed = JSON.parse(result);
    return NextResponse.json({
      code,
      article: articleId,
      title: parsed.title || parsed.product_key || "",
      text: parsed.full_text || parsed.text || result,
      annotation: parsed.note || "",
    });
  } catch {
    return NextResponse.json({
      code, article: articleId,
      title: articleId,
      text: result,
      annotation: "",
    });
  }
}
