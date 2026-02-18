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
  IMAGE: "Изображение",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Defaults ───
export const DEFAULT_ICON_COLOR = "#4F6EF7";
export const DEFAULT_AGENT_ICON = "Bot";
export const DEFAULT_SKILL_ICON = "Scale";
export const DEFAULT_TOOL_ICON = "Wrench";
export const DEFAULT_PLUGIN_ICON = "Puzzle";

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
export const TOOL_RESPONSE_CAP = 10 * 1024; // 10KB

// ─── Icon & Color palettes ───
export const VALID_ICONS = [
  "Bot","Scale","Briefcase","Shield","BookOpen","Gavel","FileText",
  "Building","User","HeartPulse","GraduationCap","Landmark",
  "Code","MessageSquare","Globe","Lightbulb","FileSearch",
  "ShieldCheck","ClipboardCheck","Brain","Triangle","Sparkles",
];
export const VALID_COLORS = [
  "#4F6EF7","#7C3AED","#10B981","#F59E0B",
  "#EF4444","#EC4899","#06B6D4","#6366F1",
];

// ─── AI Defaults ───
export const DEFAULT_TEMPERATURE = 0.6;
export const DEFAULT_TEMPERATURE_CODE_FIX = 0.2;
export const DEFAULT_TEMPERATURE_COMPACTION = 0.3;
export const DEFAULT_TEMPERATURE_PREVIEW = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_MAX_TOKENS_GENERATE = 2048;
export const DEFAULT_MAX_TOKENS_FIX = 8192;
export const DEFAULT_MAX_TOKENS_PREVIEW = 512;
export const DEFAULT_MAX_TOKENS_COMPACTION = 2048;
export const DEFAULT_TOP_P = 0.95;
export const DEFAULT_CONTEXT_WINDOW = 128000;

// ─── Fallback provider (used only when no model resolved from DB) ───
export const FALLBACK_PROVIDER_SLUG = "deepinfra";

// ─── File limits ───
export const MAX_FILE_SIZE_PARSE = 20 * 1024 * 1024; // 20MB
export const MAX_LOGO_SIZE = 512 * 1024; // 512KB

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
export const DEFAULT_CURRENCY = "KZT";
export const STRIPE_API_VERSION = "2026-01-28.clover" as const;
export const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 3;

// ─── Auth ───
export const BCRYPT_SALT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const DEFAULT_SESSION_TTL_HOURS = 720;

// ─── Email ───
export const DEFAULT_SMTP_PORT = 587;
export const DEFAULT_EMAIL_FROM = "noreply@sanbao.ai";

// ─── Image generation ───
export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const DEFAULT_IMAGE_COUNT = 1;

// ─── Code preview CDN ───
export const REACT_CDN_URL = "https://unpkg.com/react@18/umd/react.development.js";
export const REACT_DOM_CDN_URL = "https://unpkg.com/react-dom@18/umd/react-dom.development.js";
export const BABEL_CDN_URL = "https://unpkg.com/@babel/standalone/babel.min.js";
export const TAILWIND_CDN_URL = "https://cdn.tailwindcss.com";
export const PYODIDE_CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js";

// ─── Native Tools ───
export const NATIVE_TOOL_HTTP_TIMEOUT_MS = 30_000;
export const NATIVE_TOOL_HTTP_MAX_TIMEOUT_MS = 60_000;
export const NATIVE_TOOL_HTTP_MAX_RESPONSE_BYTES = 50 * 1024; // 50KB
export const NATIVE_TOOL_CSV_MAX_BYTES = 100 * 1024; // 100KB
export const NATIVE_TOOL_CSV_MAX_ROWS = 10_000;
export const NATIVE_TOOL_MAX_TURNS = 5;

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
