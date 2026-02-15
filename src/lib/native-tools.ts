// ─── Native Tools Entry Point ──────────────────────────
// Re-exports registry + triggers side-effect registration of all tool modules.
// Dispatch order in route.ts: MCP tools → Native tools → $web_search

// Side-effect imports: each module calls registerNativeTool() on load
import "./native-tools/system";
import "./native-tools/http-request";
import "./native-tools/productivity";
import "./native-tools/analysis";
import "./native-tools/content";

// Re-export everything from registry
export {
  registerNativeTool,
  isNativeTool,
  executeNativeTool,
  getNativeToolDefinitions,
  type NativeToolContext,
  type NativeToolDefinition,
} from "./native-tools/registry";
