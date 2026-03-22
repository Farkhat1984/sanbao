/**
 * Shared types for the settings registry.
 *
 * Extracted so that every domain module can import without circular deps.
 */

// ─── Category type ───

export type SettingCategory =
  | "ai_llm"
  | "context_chat"
  | "rate_limiting"
  | "streaming_tools"
  | "native_tools"
  | "mcp"
  | "cache"
  | "security_auth"
  | "files_storage"
  | "swarm"
  | "webhooks"
  | "billing"
  | "pagination"
  | "email"
  | "timeouts"
  | "integrations"
  | "redis"
  | "misc";

// ─── Category metadata ───

interface CategoryMeta {
  label: string;
  description: string;
  order: number;
}

export const CATEGORY_META: Record<SettingCategory, CategoryMeta> = {
  ai_llm: {
    label: "AI / LLM",
    description: "Параметры генерации: температура, токены, контекстное окно",
    order: 1,
  },
  context_chat: {
    label: "Контекст и чат",
    description: "Управление контекстом, компактификация, лимиты сообщений",
    order: 2,
  },
  rate_limiting: {
    label: "Лимиты запросов",
    description: "Защита от злоупотреблений: лимиты, блокировки, окна нарушений",
    order: 3,
  },
  streaming_tools: {
    label: "Стриминг и инструменты",
    description: "Таймауты, буферы, лимиты вызовов инструментов",
    order: 4,
  },
  native_tools: {
    label: "Встроенные инструменты",
    description: "HTTP, CSV, поиск знаний — лимиты встроенных инструментов",
    order: 5,
  },
  mcp: {
    label: "MCP серверы",
    description: "Подключение, пул, таймауты MCP серверов",
    order: 6,
  },
  cache: {
    label: "Кеширование",
    description: "TTL кешей, размеры, уровни кеширования L1/L2",
    order: 7,
  },
  security_auth: {
    label: "Безопасность",
    description: "Авторизация, пароли, сессии, токены",
    order: 8,
  },
  files_storage: {
    label: "Файлы и хранилище",
    description: "Лимиты загрузки, S3, размеры файлов",
    order: 9,
  },
  swarm: {
    label: "Мультиагенты",
    description: "Мультиагентная маршрутизация: таймауты, итерации",
    order: 10,
  },
  webhooks: {
    label: "Вебхуки",
    description: "Доставка, повторы, таймауты вебхуков",
    order: 11,
  },
  billing: {
    label: "Биллинг",
    description: "Валюта, уведомления об истечении подписки",
    order: 12,
  },
  pagination: {
    label: "Пагинация",
    description: "Размеры страниц, лимиты экспорта",
    order: 13,
  },
  email: {
    label: "Email",
    description: "SMTP, адрес отправителя",
    order: 14,
  },
  timeouts: {
    label: "Таймауты",
    description: "Общие таймауты: LLM, провайдеры, health-check",
    order: 15,
  },
  integrations: {
    label: "Интеграции",
    description: "1С, OData и другие внешние системы",
    order: 16,
  },
  redis: {
    label: "Redis",
    description: "Параметры подключения к Redis: повторы, таймауты",
    order: 18,
  },
  misc: {
    label: "Прочее",
    description: "Прочие настройки",
    order: 17,
  },
};

// ─── Setting definition ───

export interface SettingDefinition {
  key: string;
  /** Russian human-readable name */
  label: string;
  /** Russian description — what it controls and what happens when you change it */
  description: string;
  category: SettingCategory;
  type: "number" | "string" | "boolean";
  /** Always string (matches SystemSetting.value column) */
  defaultValue: string;
  validation?: {
    min?: number;
    max?: number;
    /** Step for number inputs */
    step?: number;
    allowedValues?: string[];
    pattern?: string;
  };
  /** Whether the value should be masked in UI (API keys, secrets) */
  sensitive?: boolean;
  /** Whether changing this setting requires a process restart */
  restartRequired?: boolean;
  /** Unit label shown in the UI: "мс", "байт", "сек", "часы", etc. */
  unit?: string;
}
