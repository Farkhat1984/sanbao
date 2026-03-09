export const APP_NAME = "Sanbao";
export const APP_DESCRIPTION = "AI-платформа для профессионалов";

export const LEGAL_TOOL_NAMES = {
  createContract: "createContract",
  createClaim: "createClaim",
  createComplaint: "createComplaint",
  analyzeNpa: "analyzeNpa",
  checkActuality: "checkActuality",
  searchArticles: "searchArticles",
} as const;

export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Договор",
  CLAIM: "Исковое заявление",
  COMPLAINT: "Жалоба",
  DOCUMENT: "Документ",
  CODE: "Код",
  ANALYSIS: "Правовой анализ",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Skill Categories ───
export const SKILL_CATEGORIES = [
  { value: "LEGAL", label: "Юридические", icon: "Scale" },
  { value: "BUSINESS", label: "Бизнес", icon: "Briefcase" },
  { value: "CODE", label: "Код", icon: "Code" },
  { value: "CONTENT", label: "Контент", icon: "MessageSquare" },
  { value: "ANALYSIS", label: "Аналитика", icon: "BarChart3" },
  { value: "PRODUCTIVITY", label: "Продуктивность", icon: "Zap" },
  { value: "CUSTOM", label: "Другое", icon: "Sparkles" },
] as const;

// ─── Defaults ───
export const DEFAULT_ICON_COLOR = "#8FAF9F";
export const DEFAULT_AGENT_ICON = "Bot";
export const DEFAULT_SKILL_ICON = "Scale";
export const DEFAULT_TOOL_ICON = "Wrench";

// ─── Pagination ───
export const DEFAULT_PAGINATION_LIMIT = 50;
export const MAX_PAGINATION_LIMIT = 100;
export const CSV_EXPORT_MAX_ROWS = 10_000;

// ─── Conversation ───
export const CONVERSATION_TITLE_MAX_LENGTH = 60;

// ─── API Keys ───
export const API_KEY_PREFIX = "lma_";
export const API_KEY_BYTES = 32;
export const WEBHOOK_SECRET_PREFIX = "whsec_";
export const WEBHOOK_SECRET_BYTES = 24;

// ─── Tool Executor ───
export const TOOL_TIMEOUT_MS = 30_000;

// ─── Tool result truncation (applied before inserting into LLM context) ───
/** Hard cap per tool result in characters (~3K tokens) */
export const TOOL_RESULT_MAX_CHARS = 12_000;
/** Keep last N chars when truncating (head + tail strategy) */
export const TOOL_RESULT_TAIL_CHARS = 1_000;
/** Hard cap on tool call turns per request (prevents runaway loops) */
export const MAX_TOOL_CALLS_PER_REQUEST = 15;

// ─── Icon & Color palettes ───
export const VALID_ICONS = [
  "Bot","Scale","Briefcase","Shield","BookOpen","Gavel","FileText",
  "Building","User","HeartPulse","GraduationCap","Landmark",
  "Code","MessageSquare","Globe","Lightbulb","FileSearch",
  "ShieldCheck","ClipboardCheck","Brain","Triangle","Sparkles",
];
export const VALID_COLORS = [
  "#8FAF9F","#B8956A","#10B981","#F59E0B",
  "#C4857A","#EC4899","#06B6D4","#5E7A8A",
];

// ─── AI Defaults ───
export const DEFAULT_TEMPERATURE = 0.6;
export const DEFAULT_TEMPERATURE_CODE_FIX = 0.2;
export const DEFAULT_TEMPERATURE_COMPACTION = 0.3;
export const DEFAULT_TEMPERATURE_PREVIEW = 0.7;
export const DEFAULT_MAX_TOKENS = 131072;
export const DEFAULT_MAX_TOKENS_GENERATE = 131072;
export const DEFAULT_MAX_TOKENS_FIX = 131072;
export const DEFAULT_MAX_TOKENS_PREVIEW = 131072;
export const DEFAULT_MAX_TOKENS_COMPACTION = 131072;
export const DEFAULT_TOP_P = 0.95;
export const DEFAULT_CONTEXT_WINDOW = 262144;

// ─── Fallback provider (used only when no model resolved from DB) ───
export const FALLBACK_PROVIDER_SLUG = "deepinfra";

// ─── File limits ───
export const MAX_FILE_SIZE_PARSE = 20 * 1024 * 1024; // 20MB
export const MAX_LOGO_SIZE = 512 * 1024; // 512KB
export const MAX_AGENT_FILE_SIZE = 100 * 1024 * 1024; // 100MB (Cloudflare limit)
/** Chars threshold for "large file" warning in chat (~12K tokens) */
export const CHAT_FILE_WARN_CHARS = 50_000;
/** Hard limit for chat file content in chars (~50K tokens) */
export const CHAT_FILE_MAX_CHARS = 200_000;

// ─── Rate limiting ───
export const VIOLATION_THRESHOLD = 10;
export const VIOLATION_WINDOW_MS = 5 * 60_000;
export const USER_BLOCK_DURATION_MS = 30 * 60_000;
export const AUTH_MAX_PER_MINUTE = 5;
export const AUTH_BLOCK_DURATION_MS = 15 * 60_000;
export const CACHE_CLEANUP_INTERVAL_MS = 300_000;

// ─── Cache TTL ───
export const CACHE_TTL = 60_000;

// ─── Context compaction ───
export const CONTEXT_COMPACTION_THRESHOLD = 0.7;
export const CONTEXT_KEEP_LAST_MESSAGES = 12;

// ─── Webhook ───
export const WEBHOOK_MAX_ATTEMPTS = 3;
export const WEBHOOK_TIMEOUT_MS = 10_000;

// ─── S3 defaults ───
export const S3_DEFAULT_BUCKET = "sanbao-uploads";
export const S3_DEFAULT_REGION = "us-east-1";
export const PRESIGNED_URL_EXPIRY = 3600;

// ─── Billing ───
export const DEFAULT_CURRENCY = "USD";
export const STRIPE_API_VERSION = "2026-01-28.clover" as const;
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 3;

// ─── Auth ───
export const BCRYPT_SALT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const DEFAULT_SESSION_TTL_HOURS = 720;

// ─── Mobile Auth (JWT rotation) ───
export const MOBILE_ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour (seconds)
export const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days (seconds)

// ─── Email ───
export const DEFAULT_SMTP_PORT = 587;
export const DEFAULT_EMAIL_FROM = "noreply@sanbao.ai";

// ─── Code preview CDN ───
export const REACT_CDN_URL = "https://unpkg.com/react@18/umd/react.development.js";
export const REACT_DOM_CDN_URL = "https://unpkg.com/react-dom@18/umd/react-dom.development.js";
export const BABEL_CDN_URL = "https://unpkg.com/@babel/standalone/babel.min.js";
export const TAILWIND_CDN_URL = "https://cdn.tailwindcss.com";
export const PYODIDE_CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js";

// ─── Integrations ───
export const INTEGRATION_TYPES = [
  { value: "ODATA_1C", label: "1С OData", icon: "Database" },
] as const;
export const INTEGRATION_DISCOVERY_TIMEOUT_MS = 15_000;

// ─── Native Tools ───
export const NATIVE_TOOL_HTTP_TIMEOUT_MS = 30_000;
export const NATIVE_TOOL_HTTP_MAX_TIMEOUT_MS = 60_000;
export const NATIVE_TOOL_HTTP_MAX_RESPONSE_BYTES = 50 * 1024; // 50KB
export const NATIVE_TOOL_CSV_MAX_BYTES = 100 * 1024; // 100KB
export const NATIVE_TOOL_CSV_MAX_ROWS = 10_000;
export const NATIVE_TOOL_MAX_TURNS = 50;
/** Max cumulative tokens per request across all tool-call loop iterations */
export const MAX_REQUEST_TOKENS = 200_000;

// ─── Swarm (Мать Роя) ───
export const SWARM_CLASSIFY_TIMEOUT_MS = 60_000;
export const SWARM_CONSULT_TIMEOUT_MS = 60_000;
export const SWARM_CONSULT_MAX_TOOL_TURNS = 2;

// ─── General LLM timeouts ───
export const LLM_TIMEOUT_MS = 30_000;
export const PROVIDER_TEST_TIMEOUT_MS = 10_000;
export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// ─── Misc ───
export const MAX_AUTO_FIX_ATTEMPTS = 3;
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/csv",
  "text/html",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
];
