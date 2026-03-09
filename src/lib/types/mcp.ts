/**
 * Re-export MCP types from @sanbao/shared.
 * This file exists for backward compatibility — all existing `@/lib/types/mcp` imports continue working.
 * New code should import directly from `@sanbao/shared/types/mcp`.
 */
export type { McpToolContext } from "@sanbao/shared/types/mcp";
