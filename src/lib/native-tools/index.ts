// ─── Native Tools Entry Point ──────────────────────────
// Re-exports registry + triggers side-effect registration of all tool modules.
// Dispatch order in route.ts: MCP tools -> Native tools -> $web_search

// Core tools: always available
import "./core/system";
import "./core/http-request";
import "./core/productivity";
import "./core/analysis";
import "./core/content";

// Integration tools: OData 1C
import "./integrations/odata-1c";

// Integration tools: WhatsApp
import "./integrations/whatsapp";

// Re-export everything from registry
export {
  registerNativeTool,
  isNativeTool,
  executeNativeTool,
  getNativeToolDefinitions,
  type NativeToolContext,
  type NativeToolDefinition,
} from "./registry";
