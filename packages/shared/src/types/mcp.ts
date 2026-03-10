/**
 * Shared MCP tool context type — used across chat streaming, tool resolution,
 * agent loading, and chat route agent resolution.
 */

/** Context for a single MCP tool, including server connection details and schema. */
export interface McpToolContext {
  url: string;
  transport: "SSE" | "STREAMABLE_HTTP";
  apiKey: string | null;
  name: string;
  /** Original tool name on the MCP server (before namespace prefix). Used for dispatch. */
  originalName?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** MCP server ID from DB — used for tool call logging */
  mcpServerId?: string;
  /** Default domain for this tool's MCP server context */
  defaultDomain?: string;
  /** Per-tool domain overrides: tool_name → domain_name */
  toolDomains?: Record<string, string>;
}
