/** Tool categories for granular status icons in the streaming indicator */
export type ToolCategory =
  | "web_search"
  | "knowledge"
  | "calculation"
  | "memory"
  | "task"
  | "notification"
  | "scratchpad"
  | "chart"
  | "http"
  | "mcp"
  | "generic";

const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  read_knowledge: "knowledge",
  search_knowledge: "knowledge",
  // MCP search tools
  lawyer_search: "knowledge",
  accountant_search: "knowledge",
  consultant_1c_search: "knowledge",
  broker_search: "knowledge",
  search: "knowledge",
  // MCP article/law retrieval tools
  get_article: "knowledge",
  get_law: "knowledge",
  accountant_get_1c_article: "knowledge",
  consultant_1c_get_1c_article: "knowledge",
  graph_traverse: "knowledge",
  lookup: "knowledge",
  // MCP SQL/query tools
  sql_query: "calculation",
  accountant_sql_query: "calculation",
  calculate: "calculation",
  analyze_csv: "calculation",
  generate_chart_data: "chart",
  save_memory: "memory",
  create_task: "task",
  send_notification: "notification",
  write_scratchpad: "scratchpad",
  read_scratchpad: "scratchpad",
  http_request: "http",
  get_current_time: "generic",
  get_user_info: "generic",
  get_conversation_context: "generic",
};

/** Resolve a tool name to its display category */
export function getToolCategory(toolName: string | null): ToolCategory {
  if (!toolName) return "generic";
  return TOOL_CATEGORY_MAP[toolName] || "mcp";
}

/**
 * Priority ordering for streaming phases.
 * Higher number = later phase. Transitions only go forward (except "searching" overlay).
 */
export const PHASE_PRIORITY: Record<string, number> = {
  thinking: 1,
  searching: 2,
  using_tool: 2,
  routing: 2,
  consulting: 2,
  planning: 3,
  synthesizing: 3,
  answering: 4,
};
