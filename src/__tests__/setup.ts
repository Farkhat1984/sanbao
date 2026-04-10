import { vi } from "vitest";

// ─── Mock @/lib/settings ─────────────────────────────────────
// Global mock for the settings system. Returns registry defaults
// so that all modules importing getSetting/getSettingNumber work
// in tests without hitting Redis/DB.
vi.mock("@/lib/settings", () => {
  // Build a defaults map from the registry at mock time
  const defaults: Record<string, string> = {
    // ai_llm
    ai_default_temperature: "0.6",
    ai_temperature_code_fix: "0.2",
    ai_temperature_compaction: "0.3",
    ai_temperature_preview: "0.7",
    ai_default_max_tokens: "131072",
    ai_max_tokens_compaction: "131072",
    ai_default_top_p: "0.95",
    ai_default_context_window: "262144",
    ai_fallback_provider: "deepinfra",
    ai_max_request_tokens: "200000",
    // context_chat
    context_compaction_threshold: "0.7",
    context_keep_last_messages: "12",
    chat_max_messages_per_request: "200",
    chat_max_message_size_bytes: "100000",
    conversation_title_max_length: "60",
    chat_max_attachments: "20",
    chat_user_files_context_limit: "30",
    chat_compaction_lock_ttl_s: "60",
    chat_messages_batch_max: "50",
    chat_max_msg_size_bytes: "200000",
    chat_plan_memory_max_chars: "2000",
    // rate_limiting
    rate_violation_threshold: "10",
    rate_violation_window_ms: "300000",
    rate_user_block_duration_ms: "1800000",
    rate_auth_max_per_minute: "5",
    rate_auth_block_duration_ms: "900000",
    rate_cache_cleanup_interval_ms: "300000",
    rate_agent_gen_per_minute: "10",
    rate_skill_gen_per_minute: "10",
    rate_skill_quick_per_minute: "5",
    rate_2fa_per_minute: "5",
    rate_admin_per_minute: "60",
    rate_fix_code_per_minute: "20",
    // streaming_tools
    tool_timeout_ms: "30000",
    tool_result_max_chars: "12000",
    tool_result_tail_chars: "1000",
    tool_max_calls_per_request: "15",
    tool_max_turns: "50",
    stream_sse_max_buffer: "1048576",
    tool_max_mcp_per_agent: "100",
    tool_agent_max_context_chars: "50000",
    tool_catalog_preview_chars: "2000",
    // native_tools
    native_http_timeout_ms: "30000",
    native_http_max_timeout_ms: "60000",
    native_http_max_response_bytes: "51200",
    native_csv_max_bytes: "102400",
    native_csv_max_rows: "10000",
    native_expression_max_length: "500",
    native_knowledge_max_files: "20",
    native_knowledge_max_response: "30000",
    native_knowledge_max_snippets: "5",
    native_knowledge_snippet_context: "150",
    native_memory_search_limit: "20",
    // mcp
    mcp_connect_timeout_ms: "15000",
    mcp_tool_call_timeout_ms: "30000",
    mcp_pool_max_idle_ms: "300000",
    mcp_pool_cleanup_interval_ms: "60000",
    mcp_tool_log_max_chars: "10000",
    // cache
    cache_ttl_ms: "60000",
    cache_agent_context_ttl_ms: "30000",
    cache_agent_context_redis_ttl_s: "60",
    cache_plan_ttl_s: "5",
    cache_agent_context_max_entries: "200",
    cache_model_router_max_entries: "200",
    cache_rate_limit_max_entries: "50000",
    // security_auth
    auth_bcrypt_rounds: "12",
    auth_password_min_length: "8",
    auth_session_ttl_hours: "720",
    auth_mobile_access_token_expiry_s: "3600",
    auth_refresh_token_expiry_s: "2592000",
    auth_password_max_length: "128",
    auth_name_max_length: "100",
    auth_invite_expiry_days: "7",
    // files_storage
    file_max_size_bytes: "10485760",
    file_max_size_parse_bytes: "20971520",
    file_max_logo_size_bytes: "524288",
    file_max_agent_file_bytes: "104857600",
    file_chat_warn_chars: "50000",
    file_chat_max_chars: "200000",
    s3_default_bucket: "sanbao-uploads",
    s3_presigned_url_expiry_s: "3600",
    user_files_max_count: "20",
    user_files_max_size_bytes: "100000",
    user_files_max_name_length: "100",
    user_files_max_description_length: "500",
    fix_code_max_code_bytes: "512000",
    fix_code_max_error_bytes: "10240",
    // swarm
    swarm_classify_timeout_ms: "60000",
    swarm_consult_timeout_ms: "60000",
    swarm_consult_max_tool_turns: "2",
    // webhooks
    webhook_max_attempts: "3",
    webhook_timeout_ms: "10000",
    // billing
    billing_default_currency: "USD",
    billing_expiry_warning_days: "3",
    // pagination
    pagination_default_limit: "50",
    pagination_max_limit: "100",
    csv_export_max_rows: "10000",
    pagination_conversations_max: "200",
    pagination_tasks_max: "200",
    pagination_memory_max: "200",
    // email
    email_default_smtp_port: "587",
    email_default_from: "noreply@sanbao.ai",
    // timeouts
    llm_timeout_ms: "30000",
    provider_test_timeout_ms: "10000",
    health_check_timeout_ms: "5000",
    // integrations
    integration_discovery_timeout_ms: "15000",
    integration_odata_catalog_max_chars: "8000",
    // redis
    redis_max_retries_per_request: "3",
    redis_retry_max_attempts: "5",
    redis_retry_max_delay_ms: "2000",
    redis_connect_timeout_ms: "5000",
    // misc
    max_auto_fix_attempts: "3",
    slug_max_length: "60",
  };

  return {
    getSetting: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(defaults[key] ?? "")
    ),
    getSettingNumber: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(Number(defaults[key] ?? "0"))
    ),
    getSettingBoolean: vi.fn().mockImplementation((key: string) => {
      const val = (defaults[key] ?? "false").toLowerCase();
      return Promise.resolve(["true", "1", "yes"].includes(val));
    }),
    getSettings: vi.fn().mockImplementation((keys: string[]) => {
      const result: Record<string, string> = {};
      for (const k of keys) {
        result[k] = defaults[k] ?? "";
      }
      return Promise.resolve(result);
    }),
    invalidateSettings: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Mock next-auth ────────────────────────────────────────
// NextAuth v5 auth() has overloaded return types (Session | NextMiddleware).
// We mock it as a simple async function returning Session | null.
vi.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authMock = vi.fn<() => Promise<any>>().mockResolvedValue({
    user: { id: "test-user-1", email: "test@test.com", role: "USER" },
  });
  return { auth: authMock };
});

// ─── Mock Prisma ───────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    message: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    agent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    agentFile: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { fileSize: 0 } }),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    conversationPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (fn: any) => {
      // Execute the transaction callback passing the same prisma mock as tx
      if (typeof fn === "function") {
        const { prisma: self } = await import("@/lib/prisma");
        return fn(self);
      }
    }),
  },
}));

// ─── Mock usage helper ─────────────────────────────────────
vi.mock("@/lib/usage", () => ({
  getUserPlanAndUsage: vi.fn().mockResolvedValue({
    plan: { maxConversations: 100, maxStorageMb: 500, maxAgents: -1, canUseAgents: true },
    usage: { messagesCount: 0 },
  }),
  incrementTokens: vi.fn(),
}));

// ─── Mock system-agents ────────────────────────────────────
vi.mock("@/lib/system-agents", () => ({
  isSystemAgent: vi.fn(() => false),
  isSystemAgentAsync: vi.fn().mockResolvedValue(false),
  getSystemAgents: vi.fn().mockResolvedValue([]),
}));

// ─── Mock fs (for agent file routes) ───────────────────────
const writeFile = vi.fn().mockResolvedValue(undefined);
const mkdir = vi.fn().mockResolvedValue(undefined);
const unlink = vi.fn().mockResolvedValue(undefined);
vi.mock("fs/promises", () => ({
  default: { writeFile, mkdir, unlink },
  writeFile,
  mkdir,
  unlink,
}));
