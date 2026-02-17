import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callMcpTool } from "@/lib/mcp-client";

const LAWYER_URL =
  process.env.LAWYER_MCP_URL || "http://localhost:8120/lawyer";
const LAWYER_TOKEN = process.env.AI_CORTEX_AUTH_TOKEN || null;

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

  const { result, error } = await callMcpTool(
    LAWYER_URL,
    "STREAMABLE_HTTP",
    LAWYER_TOKEN,
    "get_article",
    { code, article },
    { userId: session.user.id }
  );

  if (error) {
    return NextResponse.json(
      { error: `MCP error: ${error}` },
      { status: 502 }
    );
  }

  // Parse MCP response — expect JSON with title, text, annotation
  try {
    const parsed = JSON.parse(result);
    return NextResponse.json({
      code,
      article,
      title: parsed.title || "",
      text: parsed.text || parsed.content || result,
      annotation: parsed.annotation || parsed.note || "",
    });
  } catch {
    // If not JSON, return raw text as article text
    return NextResponse.json({
      code,
      article,
      title: `Статья ${article}`,
      text: result,
      annotation: "",
    });
  }
}
