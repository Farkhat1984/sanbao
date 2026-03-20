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
  // MCP search/retrieval tools (all variants including prefixed)
  search: "knowledge",
  lawyer_search: "knowledge",
  accountant_search: "knowledge",
  consultant_1c_search: "knowledge",
  broker_search: "knowledge",
  lookup: "knowledge",
  lawyer_lookup: "knowledge",
  // MCP article/law/document retrieval tools
  get_article: "knowledge",
  get_law: "knowledge",
  get_1c_article: "knowledge",
  get_tnved_item: "knowledge",
  get_document: "knowledge",
  get_source: "knowledge",
  resolve_document: "knowledge",
  accountant_get_1c_article: "knowledge",
  consultant_1c_get_1c_article: "knowledge",
  graph_traverse: "knowledge",
  lawyer_graph_traverse: "knowledge",
  // MCP analysis tools
  summarize: "knowledge",
  qa: "knowledge",
  extract_entities: "knowledge",
  timeline: "knowledge",
  aggregate: "knowledge",
  cross_reference: "knowledge",
  compare: "knowledge",
  // MCP domain tools
  list_domains: "knowledge",
  get_exchange_rate: "knowledge",
  classify_goods: "knowledge",
  calculate_duties: "calculation",
  get_required_docs: "knowledge",
  generate_declaration: "knowledge",
  // MCP SQL/query tools
  sql_query: "calculation",
  accountant_sql_query: "calculation",
  broker_sql_query: "calculation",
  lawyer_sql_query: "calculation",
  calculate: "calculation",
  analyze_csv: "calculation",
  generate_chart_data: "chart",
  // Native tools
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
  if (toolName === "$web_search") return "web_search";
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
