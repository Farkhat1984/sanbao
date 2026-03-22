/**
 * Settings registry — re-exports all domain modules into a single registry.
 *
 * Each domain module owns its own `SettingDefinition[]` array.
 * This index combines them and exposes the same public API as the
 * original monolithic `settings-registry.ts`.
 */

// ─── Types & category metadata ───

export type { SettingCategory, SettingDefinition } from "./types";
export { CATEGORY_META } from "./types";

// ─── Domain modules ───

export { AI_LLM_SETTINGS } from "./ai-llm";
export { CONTEXT_CHAT_SETTINGS } from "./context-chat";
export { RATE_LIMITING_SETTINGS } from "./rate-limiting";
export { STREAMING_TOOLS_SETTINGS } from "./streaming-tools";
export { NATIVE_TOOLS_SETTINGS } from "./native-tools";
export { MCP_SETTINGS } from "./mcp";
export { CACHE_SETTINGS } from "./cache";
export { AUTH_SETTINGS } from "./auth";
export { FILES_STORAGE_SETTINGS } from "./files-storage";
export { SWARM_SETTINGS } from "./swarm";
export { WEBHOOKS_SETTINGS } from "./webhooks";
export { BILLING_SETTINGS } from "./billing";
export { PAGINATION_SETTINGS } from "./pagination";
export { EMAIL_SETTINGS } from "./email";
export { TIMEOUTS_SETTINGS } from "./timeouts";
export { INTEGRATIONS_SETTINGS } from "./integrations";
export { REDIS_SETTINGS } from "./redis";
export { MISC_SETTINGS } from "./misc";

// ─── Domain imports for assembly ───

import { AI_LLM_SETTINGS } from "./ai-llm";
import { CONTEXT_CHAT_SETTINGS } from "./context-chat";
import { RATE_LIMITING_SETTINGS } from "./rate-limiting";
import { STREAMING_TOOLS_SETTINGS } from "./streaming-tools";
import { NATIVE_TOOLS_SETTINGS } from "./native-tools";
import { MCP_SETTINGS } from "./mcp";
import { CACHE_SETTINGS } from "./cache";
import { AUTH_SETTINGS } from "./auth";
import { FILES_STORAGE_SETTINGS } from "./files-storage";
import { SWARM_SETTINGS } from "./swarm";
import { WEBHOOKS_SETTINGS } from "./webhooks";
import { BILLING_SETTINGS } from "./billing";
import { PAGINATION_SETTINGS } from "./pagination";
import { EMAIL_SETTINGS } from "./email";
import { TIMEOUTS_SETTINGS } from "./timeouts";
import { INTEGRATIONS_SETTINGS } from "./integrations";
import { REDIS_SETTINGS } from "./redis";
import { MISC_SETTINGS } from "./misc";
import type { SettingDefinition } from "./types";

// ─── Combined registry (preserves original order) ───

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  ...AI_LLM_SETTINGS,
  ...CONTEXT_CHAT_SETTINGS,
  ...RATE_LIMITING_SETTINGS,
  ...STREAMING_TOOLS_SETTINGS,
  ...NATIVE_TOOLS_SETTINGS,
  ...MCP_SETTINGS,
  ...CACHE_SETTINGS,
  ...AUTH_SETTINGS,
  ...FILES_STORAGE_SETTINGS,
  ...SWARM_SETTINGS,
  ...WEBHOOKS_SETTINGS,
  ...BILLING_SETTINGS,
  ...PAGINATION_SETTINGS,
  ...EMAIL_SETTINGS,
  ...TIMEOUTS_SETTINGS,
  ...INTEGRATIONS_SETTINGS,
  ...REDIS_SETTINGS,
  ...MISC_SETTINGS,
];

// ─── O(1) lookup map ───

export const SETTINGS_MAP: Map<string, SettingDefinition> = new Map(
  SETTINGS_REGISTRY.map((s) => [s.key, s]),
);
