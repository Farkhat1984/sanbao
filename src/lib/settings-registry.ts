/**
 * Complete metadata registry for all 118 runtime-configurable settings.
 *
 * Each setting maps 1:1 to a `SystemSetting` row in the database.
 * Default values are kept in sync with `constants.ts`.
 *
 * Used by:
 * - Admin settings UI (renders form controls, validation, descriptions)
 * - Setting resolution layer (provides typed defaults when DB row is absent)
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

// ─── Registry: 113 settings ───

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  // ═══════════════════════════════════════════════════════════════
  // ai_llm (10)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "ai_default_temperature",
    label: "Температура по умолчанию",
    description:
      "Температура генерации для обычных чатов. Выше = более креативные ответы, ниже = более предсказуемые. При 0 — полностью детерминированный вывод",
    category: "ai_llm",
    type: "number",
    defaultValue: "0.6",
    validation: { min: 0, max: 2, step: 0.1 },
  },
  {
    key: "ai_temperature_code_fix",
    label: "Температура (исправление кода)",
    description:
      "Температура при исправлении кода. Низкое значение обеспечивает точные и детерминированные исправления",
    category: "ai_llm",
    type: "number",
    defaultValue: "0.2",
    validation: { min: 0, max: 2, step: 0.1 },
  },
  {
    key: "ai_temperature_compaction",
    label: "Температура (компактификация)",
    description:
      "Температура при сжатии контекста диалога. Низкое значение сохраняет точность при суммаризации",
    category: "ai_llm",
    type: "number",
    defaultValue: "0.3",
    validation: { min: 0, max: 2, step: 0.1 },
  },
  {
    key: "ai_temperature_preview",
    label: "Температура (предпросмотр)",
    description:
      "Температура при тестировании агентов через предпросмотр. Чуть выше стандартной для демонстрации креативности",
    category: "ai_llm",
    type: "number",
    defaultValue: "0.7",
    validation: { min: 0, max: 2, step: 0.1 },
  },
  {
    key: "ai_default_max_tokens",
    label: "Макс. токенов (генерация)",
    description:
      "Максимальное количество токенов для генерации ответа. Увеличение позволяет длинные ответы, но повышает расход",
    category: "ai_llm",
    type: "number",
    defaultValue: "131072",
    validation: { min: 1024, max: 1048576 },
    unit: "токенов",
  },
  {
    key: "ai_max_tokens_compaction",
    label: "Макс. токенов (компактификация)",
    description:
      "Лимит токенов при сжатии контекста. Должен быть достаточным для полноценного саммари диалога",
    category: "ai_llm",
    type: "number",
    defaultValue: "131072",
    validation: { min: 1024, max: 1048576 },
    unit: "токенов",
  },
  {
    key: "ai_default_top_p",
    label: "Top-P (nucleus sampling)",
    description:
      "Порог вероятностного отбора токенов. 0.95 = рассматривается 95% вероятностной массы. Уменьшение сужает разнообразие",
    category: "ai_llm",
    type: "number",
    defaultValue: "0.95",
    validation: { min: 0, max: 1, step: 0.05 },
  },
  {
    key: "ai_default_context_window",
    label: "Контекстное окно по умолчанию",
    description:
      "Размер контекстного окна в токенах. Используется как фолбэк, если у модели нет своего значения",
    category: "ai_llm",
    type: "number",
    defaultValue: "262144",
    validation: { min: 4096, max: 2097152 },
    unit: "токенов",
  },
  {
    key: "ai_fallback_provider",
    label: "Фолбэк-провайдер",
    description:
      "Slug провайдера по умолчанию, если модель не разрешена из БД. Должен совпадать с AiProvider.slug",
    category: "ai_llm",
    type: "string",
    defaultValue: "deepinfra",
  },
  {
    key: "ai_max_request_tokens",
    label: "Макс. токенов на запрос",
    description:
      "Кумулятивный лимит токенов за один запрос (все итерации tool-loop). Защита от чрезмерного потребления",
    category: "ai_llm",
    type: "number",
    defaultValue: "200000",
    validation: { min: 10000, max: 2000000 },
    unit: "токенов",
  },

  // ═══════════════════════════════════════════════════════════════
  // context_chat (11)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "context_compaction_threshold",
    label: "Порог компактификации",
    description:
      "Доля заполнения контекстного окна (0-1), при которой запускается автоматическое сжатие. 0.7 = при 70% заполнении",
    category: "context_chat",
    type: "number",
    defaultValue: "0.7",
    validation: { min: 0.3, max: 0.95, step: 0.05 },
  },
  {
    key: "context_keep_last_messages",
    label: "Сообщений при компактификации",
    description:
      "Количество последних сообщений, которые НЕ сжимаются при компактификации. Больше = лучше контекст, но больше токенов",
    category: "context_chat",
    type: "number",
    defaultValue: "12",
    validation: { min: 2, max: 50 },
    unit: "шт.",
  },
  {
    key: "chat_max_messages_per_request",
    label: "Макс. сообщений в запросе",
    description:
      "Максимальное количество сообщений в массиве при вызове /api/chat. Защита от переполнения контекста",
    category: "context_chat",
    type: "number",
    defaultValue: "200",
    validation: { min: 10, max: 1000 },
    unit: "шт.",
  },
  {
    key: "chat_max_message_size_bytes",
    label: "Макс. размер сообщения",
    description:
      "Максимальный размер одного сообщения в байтах. Сообщения больше этого лимита отклоняются",
    category: "context_chat",
    type: "number",
    defaultValue: "100000",
    validation: { min: 1000, max: 1000000 },
    unit: "байт",
  },
  {
    key: "conversation_title_max_length",
    label: "Макс. длина заголовка",
    description:
      "Максимальная длина автоматически сгенерированного заголовка диалога в символах",
    category: "context_chat",
    type: "number",
    defaultValue: "60",
    validation: { min: 20, max: 200 },
    unit: "символов",
  },
  {
    key: "chat_max_attachments",
    label: "Макс. вложений",
    description:
      "Максимальное количество вложений (файлов) в одном запросе к чату",
    category: "context_chat",
    type: "number",
    defaultValue: "20",
    validation: { min: 1, max: 50 },
    unit: "шт.",
  },
  {
    key: "chat_user_files_context_limit",
    label: "Файлов пользователя в контексте",
    description:
      "Количество пользовательских файлов, загружаемых в контекст чата (take:N)",
    category: "context_chat",
    type: "number",
    defaultValue: "30",
    validation: { min: 5, max: 100 },
    unit: "шт.",
  },
  {
    key: "chat_compaction_lock_ttl_s",
    label: "TTL блокировки компактификации",
    description:
      "Время жизни Redis-блокировки компактификации (секунды). Предотвращает одновременную компактификацию",
    category: "context_chat",
    type: "number",
    defaultValue: "60",
    validation: { min: 10, max: 300 },
    unit: "сек",
  },
  {
    key: "chat_messages_batch_max",
    label: "Макс. сообщений в батче",
    description:
      "Максимальное количество сообщений при пакетном сохранении через API",
    category: "context_chat",
    type: "number",
    defaultValue: "50",
    validation: { min: 10, max: 500 },
    unit: "шт.",
  },
  {
    key: "chat_max_msg_size_bytes",
    label: "Макс. размер сообщения (сохранение)",
    description:
      "Максимальный размер одного сообщения при пакетном сохранении (200 КБ)",
    category: "context_chat",
    type: "number",
    defaultValue: "200000",
    validation: { min: 10000, max: 1000000 },
    unit: "байт",
  },
  {
    key: "chat_plan_memory_max_chars",
    label: "Макс. символов памяти плана",
    description:
      "Лимит символов для памяти плана в диалоге. Обрезается при превышении",
    category: "context_chat",
    type: "number",
    defaultValue: "2000",
    validation: { min: 500, max: 10000 },
    unit: "символов",
  },

  // ═══════════════════════════════════════════════════════════════
  // rate_limiting (12)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "rate_violation_threshold",
    label: "Порог нарушений для блокировки",
    description:
      "Количество нарушений лимита в окне, после которого пользователь автоматически блокируется",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 3, max: 100 },
    unit: "шт.",
  },
  {
    key: "rate_violation_window_ms",
    label: "Окно подсчёта нарушений",
    description:
      "Временное окно для подсчёта нарушений (по умолчанию 5 минут). Нарушения старше окна сбрасываются",
    category: "rate_limiting",
    type: "number",
    defaultValue: "300000",
    validation: { min: 60000, max: 3600000 },
    unit: "мс",
  },
  {
    key: "rate_user_block_duration_ms",
    label: "Длительность блокировки",
    description:
      "Время блокировки пользователя за превышение порога нарушений (по умолчанию 30 минут)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "1800000",
    validation: { min: 60000, max: 86400000 },
    unit: "мс",
  },
  {
    key: "rate_auth_max_per_minute",
    label: "Попыток авторизации в минуту",
    description:
      "Максимум попыток логина/регистрации с одного IP в минуту. Защита от брутфорса",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 60 },
    unit: "шт./мин",
  },
  {
    key: "rate_auth_block_duration_ms",
    label: "Блокировка IP за авторизацию",
    description:
      "Длительность блокировки IP при превышении лимита попыток авторизации (по умолчанию 15 мин)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "900000",
    validation: { min: 60000, max: 86400000 },
    unit: "мс",
  },
  {
    key: "rate_cache_cleanup_interval_ms",
    label: "Интервал очистки кеша лимитов",
    description:
      "Как часто очищаются устаревшие записи in-memory таблицы лимитов (по умолчанию 5 мин)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "300000",
    validation: { min: 30000, max: 3600000 },
    unit: "мс",
    restartRequired: true,
  },
  {
    key: "rate_agent_gen_per_minute",
    label: "Лимит генерации агентов/мин",
    description:
      "Максимум запросов генерации агентов в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_skill_gen_per_minute",
    label: "Лимит генерации навыков/мин",
    description:
      "Максимум запросов генерации навыков в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_skill_quick_per_minute",
    label: "Лимит быстрого создания навыков/мин",
    description:
      "Максимум запросов быстрого создания навыков в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_2fa_per_minute",
    label: "Лимит попыток 2FA/мин",
    description:
      "Максимум попыток ввода кода 2FA в минуту. Защита от перебора TOTP-кодов",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_admin_per_minute",
    label: "Лимит админ-запросов/мин",
    description:
      "Максимум запросов к админ-API в минуту на администратора",
    category: "rate_limiting",
    type: "number",
    defaultValue: "60",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_fix_code_per_minute",
    label: "Лимит исправления кода/мин",
    description:
      "Максимум запросов на исправление кода в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "20",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },

  // ═══════════════════════════════════════════════════════════════
  // streaming_tools (9)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "tool_timeout_ms",
    label: "Таймаут инструмента",
    description:
      "Таймаут выполнения WEBHOOK/URL инструментов. При превышении — ошибка таймаута",
    category: "streaming_tools",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "tool_result_max_chars",
    label: "Макс. символов результата",
    description:
      "Жёсткий лимит символов результата инструмента перед вставкой в контекст (~3K токенов)",
    category: "streaming_tools",
    type: "number",
    defaultValue: "12000",
    validation: { min: 1000, max: 100000 },
    unit: "символов",
  },
  {
    key: "tool_result_tail_chars",
    label: "Символов в хвосте при обрезке",
    description:
      "При обрезке длинного результата сохраняются начало и конец. Это количество символов от конца",
    category: "streaming_tools",
    type: "number",
    defaultValue: "1000",
    validation: { min: 100, max: 10000 },
    unit: "символов",
  },
  {
    key: "tool_max_calls_per_request",
    label: "Макс. вызовов за запрос",
    description:
      "Максимальное количество последовательных вызовов инструментов за один запрос. Защита от зацикливания",
    category: "streaming_tools",
    type: "number",
    defaultValue: "15",
    validation: { min: 1, max: 100 },
    unit: "шт.",
  },
  {
    key: "tool_max_turns",
    label: "Макс. итераций tool-loop",
    description:
      "Максимум итераций цикла вызова native-инструментов. Включает все виды: MCP, native, web_search",
    category: "streaming_tools",
    type: "number",
    defaultValue: "50",
    validation: { min: 5, max: 200 },
    unit: "шт.",
  },
  {
    key: "stream_sse_max_buffer",
    label: "Макс. SSE буфер",
    description:
      "Максимальный размер буфера одной SSE строки. При превышении — строка пропускается как corrupted",
    category: "streaming_tools",
    type: "number",
    defaultValue: "1048576",
    validation: { min: 65536, max: 10485760 },
    unit: "байт",
  },
  {
    key: "tool_max_mcp_per_agent",
    label: "Макс. MCP инструментов на агента",
    description:
      "Лимит MCP-инструментов при загрузке для одного агента. Больше = медленнее старт чата",
    category: "streaming_tools",
    type: "number",
    defaultValue: "100",
    validation: { min: 10, max: 500 },
    unit: "шт.",
  },
  {
    key: "tool_agent_max_context_chars",
    label: "Макс. символов контекста агента",
    description:
      "Максимальный объём текста из файлов агента, включаемый в контекст",
    category: "streaming_tools",
    type: "number",
    defaultValue: "50000",
    validation: { min: 10000, max: 500000 },
    unit: "символов",
  },
  {
    key: "tool_catalog_preview_chars",
    label: "Символов предпросмотра каталога",
    description:
      "Количество символов из OData/1С каталога для предпросмотра в контексте",
    category: "streaming_tools",
    type: "number",
    defaultValue: "2000",
    validation: { min: 500, max: 10000 },
    unit: "символов",
  },

  // ═══════════════════════════════════════════════════════════════
  // native_tools (11)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "native_http_timeout_ms",
    label: "HTTP таймаут по умолчанию",
    description:
      "Таймаут HTTP-запросов для native-инструмента http_request (если пользователь не указал свой)",
    category: "native_tools",
    type: "number",
    defaultValue: "30000",
    validation: { min: 1000, max: 120000 },
    unit: "мс",
  },
  {
    key: "native_http_max_timeout_ms",
    label: "Макс. HTTP таймаут",
    description:
      "Верхняя граница таймаута, которую пользователь может задать в параметрах http_request",
    category: "native_tools",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "native_http_max_response_bytes",
    label: "Макс. размер HTTP ответа",
    description:
      "Лимит тела ответа для http_request. Защита от загрузки огромных страниц в контекст",
    category: "native_tools",
    type: "number",
    defaultValue: "51200",
    validation: { min: 1024, max: 1048576 },
    unit: "байт",
  },
  {
    key: "native_csv_max_bytes",
    label: "Макс. размер CSV",
    description:
      "Лимит размера CSV файла для analyze_csv. Большие файлы отклоняются",
    category: "native_tools",
    type: "number",
    defaultValue: "102400",
    validation: { min: 1024, max: 10485760 },
    unit: "байт",
  },
  {
    key: "native_csv_max_rows",
    label: "Макс. строк CSV",
    description:
      "Максимум строк для обработки в analyze_csv. Строки сверх лимита игнорируются",
    category: "native_tools",
    type: "number",
    defaultValue: "10000",
    validation: { min: 100, max: 1000000 },
    unit: "шт.",
  },
  {
    key: "native_expression_max_length",
    label: "Макс. длина мат. выражения",
    description:
      "Максимальная длина математического выражения для инструмента calculate",
    category: "native_tools",
    type: "number",
    defaultValue: "500",
    validation: { min: 100, max: 5000 },
    unit: "символов",
  },
  {
    key: "native_knowledge_max_files",
    label: "Макс. файлов поиска знаний",
    description:
      "Максимальное количество файлов для поиска в read_knowledge",
    category: "native_tools",
    type: "number",
    defaultValue: "20",
    validation: { min: 5, max: 100 },
    unit: "шт.",
  },
  {
    key: "native_knowledge_max_response",
    label: "Макс. размер ответа знаний",
    description:
      "Максимальный размер ответа от read_knowledge (символы)",
    category: "native_tools",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 200000 },
    unit: "символов",
  },
  {
    key: "native_knowledge_max_snippets",
    label: "Макс. сниппетов на файл",
    description:
      "Количество найденных фрагментов для каждого файла в read_knowledge",
    category: "native_tools",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 20 },
    unit: "шт.",
  },
  {
    key: "native_knowledge_snippet_context",
    label: "Контекст вокруг совпадения",
    description:
      "Количество символов до и после совпадения в сниппете знаний",
    category: "native_tools",
    type: "number",
    defaultValue: "150",
    validation: { min: 50, max: 500 },
    unit: "символов",
  },
  {
    key: "native_memory_search_limit",
    label: "Макс. результатов поиска памяти",
    description:
      "Максимальное количество записей памяти, возвращаемых search_knowledge",
    category: "native_tools",
    type: "number",
    defaultValue: "20",
    validation: { min: 5, max: 100 },
    unit: "шт.",
  },

  // ═══════════════════════════════════════════════════════════════
  // mcp (5)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "mcp_connect_timeout_ms",
    label: "Таймаут подключения MCP",
    description:
      "Время ожидания подключения к MCP серверу. При превышении — ошибка подключения",
    category: "mcp",
    type: "number",
    defaultValue: "15000",
    validation: { min: 3000, max: 120000 },
    unit: "мс",
  },
  {
    key: "mcp_tool_call_timeout_ms",
    label: "Таймаут вызова MCP",
    description:
      "Время ожидания выполнения MCP инструмента. Долгие инструменты (поиск) могут требовать увеличения",
    category: "mcp",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "mcp_pool_max_idle_ms",
    label: "Макс. простой соединения",
    description:
      "Время простоя MCP-соединения до его закрытия. Экономит ресурсы при неактивных серверах",
    category: "mcp",
    type: "number",
    defaultValue: "300000",
    validation: { min: 30000, max: 3600000 },
    unit: "мс",
  },
  {
    key: "mcp_pool_cleanup_interval_ms",
    label: "Интервал очистки пула",
    description:
      "Как часто проверяются и закрываются устаревшие MCP-соединения",
    category: "mcp",
    type: "number",
    defaultValue: "60000",
    validation: { min: 10000, max: 600000 },
    unit: "мс",
  },
  {
    key: "mcp_tool_log_max_chars",
    label: "Макс. символов лога MCP",
    description:
      "Максимальная длина вывода при записи в McpToolLog. Длинные результаты обрезаются",
    category: "mcp",
    type: "number",
    defaultValue: "10000",
    validation: { min: 1000, max: 100000 },
    unit: "символов",
  },

  // ═══════════════════════════════════════════════════════════════
  // cache (8)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "cache_ttl_ms",
    label: "TTL общего кеша",
    description:
      "Время жизни in-memory кеша (модели, фильтры, IP). Меньше = свежее данные, больше = меньше нагрузка на БД",
    category: "cache",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 600000 },
    unit: "мс",
  },
  {
    key: "cache_agent_context_ttl_ms",
    label: "TTL контекста агента (L1)",
    description:
      "Время жизни L1 кеша контекста агента в памяти. При изменении агента — ждать до TTL",
    category: "cache",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "cache_agent_context_redis_ttl_s",
    label: "TTL контекста агента (L2 Redis)",
    description:
      "Время жизни L2 кеша контекста агента в Redis. Должен быть >= L1 TTL",
    category: "cache",
    type: "number",
    defaultValue: "60",
    validation: { min: 10, max: 600 },
    unit: "сек",
  },
  {
    key: "cache_plan_ttl_s",
    label: "TTL кеша плана",
    description:
      "Время жизни кеша данных плана пользователя в Redis. Низкий TTL для актуальности лимитов",
    category: "cache",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 60 },
    unit: "сек",
  },
  {
    key: "cache_agent_context_max_entries",
    label: "Макс. записей кеша агентов",
    description:
      "Размер BoundedMap для кеша контекста агентов в памяти",
    category: "cache",
    type: "number",
    defaultValue: "200",
    validation: { min: 50, max: 1000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_model_router_max_entries",
    label: "Макс. записей кеша моделей",
    description:
      "Размер BoundedMap для кеша роутера моделей в памяти",
    category: "cache",
    type: "number",
    defaultValue: "200",
    validation: { min: 50, max: 1000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_rate_limit_max_entries",
    label: "Макс. записей лимитов",
    description:
      "Размер BoundedMap для хранения данных rate-limit в памяти",
    category: "cache",
    type: "number",
    defaultValue: "50000",
    validation: { min: 10000, max: 500000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_system_agents_ttl_ms",
    label: "TTL кеша системных агентов",
    description:
      "Время жизни кеша списка системных агентов. При добавлении/удалении системного агента — ждать до TTL",
    category: "cache",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 600000 },
    unit: "мс",
  },

  // ═══════════════════════════════════════════════════════════════
  // security_auth (9)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "auth_bcrypt_rounds",
    label: "Раунды bcrypt",
    description:
      "Количество раундов хеширования паролей. Больше = безопаснее, но регистрация/логин медленнее. 12 = ~250мс",
    category: "security_auth",
    type: "number",
    defaultValue: "12",
    validation: { min: 8, max: 16 },
  },
  {
    key: "auth_password_min_length",
    label: "Мин. длина пароля",
    description:
      "Минимальная длина пароля при регистрации. Короткие пароли легче взломать",
    category: "security_auth",
    type: "number",
    defaultValue: "8",
    validation: { min: 6, max: 32 },
    unit: "символов",
  },
  {
    key: "auth_session_ttl_hours",
    label: "TTL сессии",
    description:
      "Время жизни сессии пользователя. 720 часов = 30 дней. По истечении — требуется повторный вход",
    category: "security_auth",
    type: "number",
    defaultValue: "720",
    validation: { min: 1, max: 8760 },
    unit: "часов",
  },
  {
    key: "auth_session_cache_ttl_ms",
    label: "TTL кеша сессии",
    description:
      "Время жизни локального кеша TTL сессии. Чем меньше — тем быстрее применяются изменения настройки session_ttl_hours, но чаще запросы к БД",
    category: "security_auth",
    type: "number",
    defaultValue: "300000",
    validation: { min: 30000, max: 1800000 },
    unit: "мс",
  },
  {
    key: "auth_mobile_access_token_expiry_s",
    label: "TTL мобильного токена",
    description:
      "Время жизни access-токена мобильного приложения. Короче = безопаснее, длиннее = удобнее",
    category: "security_auth",
    type: "number",
    defaultValue: "3600",
    validation: { min: 300, max: 86400 },
    unit: "сек",
  },
  {
    key: "auth_refresh_token_expiry_s",
    label: "TTL refresh-токена",
    description:
      "Время жизни refresh-токена мобильного приложения. 2592000 = 30 дней",
    category: "security_auth",
    type: "number",
    defaultValue: "2592000",
    validation: { min: 86400, max: 31536000 },
    unit: "сек",
  },
  {
    key: "auth_password_max_length",
    label: "Макс. длина пароля",
    description:
      "Максимальная длина пароля при регистрации. Защита от DoS при хешировании",
    category: "security_auth",
    type: "number",
    defaultValue: "128",
    validation: { min: 64, max: 1024 },
    unit: "символов",
  },
  {
    key: "auth_name_max_length",
    label: "Макс. длина имени",
    description:
      "Максимальная длина имени пользователя при регистрации",
    category: "security_auth",
    type: "number",
    defaultValue: "100",
    validation: { min: 20, max: 500 },
    unit: "символов",
  },
  {
    key: "auth_invite_expiry_days",
    label: "Срок действия приглашения",
    description:
      "Количество дней, в течение которых действует ссылка-приглашение в организацию",
    category: "security_auth",
    type: "number",
    defaultValue: "7",
    validation: { min: 1, max: 30 },
    unit: "дней",
  },

  // ═══════════════════════════════════════════════════════════════
  // files_storage (14)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "file_max_size_bytes",
    label: "Макс. размер файла",
    description:
      "Максимальный размер загружаемого файла (10 МБ). Увеличение требует проверки Cloudflare лимитов",
    category: "files_storage",
    type: "number",
    defaultValue: "10485760",
    validation: { min: 1048576, max: 104857600 },
    unit: "байт",
  },
  {
    key: "file_max_size_parse_bytes",
    label: "Макс. файл для парсинга",
    description:
      "Максимальный размер файла при парсинге содержимого (20 МБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "20971520",
    validation: { min: 1048576, max: 209715200 },
    unit: "байт",
  },
  {
    key: "file_max_logo_size_bytes",
    label: "Макс. размер логотипа",
    description: "Максимальный размер логотипа/аватара (512 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "524288",
    validation: { min: 51200, max: 5242880 },
    unit: "байт",
  },
  {
    key: "file_max_agent_file_bytes",
    label: "Макс. файл агента",
    description:
      "Максимальный размер файла для загрузки в агента (100 МБ). Ограничен Cloudflare",
    category: "files_storage",
    type: "number",
    defaultValue: "104857600",
    validation: { min: 1048576, max: 524288000 },
    unit: "байт",
  },
  {
    key: "file_chat_warn_chars",
    label: "Порог предупреждения",
    description:
      "Количество символов файла, при котором показывается предупреждение в чате о большом объёме",
    category: "files_storage",
    type: "number",
    defaultValue: "50000",
    validation: { min: 5000, max: 500000 },
    unit: "символов",
  },
  {
    key: "file_chat_max_chars",
    label: "Макс. символов файла в чат",
    description:
      "Жёсткий лимит символов файла для вставки в контекст. Файлы больше обрезаются",
    category: "files_storage",
    type: "number",
    defaultValue: "200000",
    validation: { min: 10000, max: 1000000 },
    unit: "символов",
  },
  {
    key: "s3_default_bucket",
    label: "S3 бакет",
    description:
      "Имя S3 бакета для хранения файлов. Изменение требует переноса данных",
    category: "files_storage",
    type: "string",
    defaultValue: "sanbao-uploads",
    restartRequired: true,
  },
  {
    key: "s3_presigned_url_expiry_s",
    label: "TTL presigned URL",
    description:
      "Время жизни предподписанной ссылки S3. После истечения — файл недоступен по ссылке",
    category: "files_storage",
    type: "number",
    defaultValue: "3600",
    validation: { min: 60, max: 86400 },
    unit: "сек",
  },
  {
    key: "user_files_max_count",
    label: "Макс. пользовательских файлов",
    description:
      "Максимальное количество текстовых файлов пользователя (без подписки)",
    category: "files_storage",
    type: "number",
    defaultValue: "20",
    validation: { min: 5, max: 200 },
    unit: "шт.",
  },
  {
    key: "user_files_max_size_bytes",
    label: "Макс. размер пользов. файла",
    description:
      "Максимальный размер одного пользовательского файла (100 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "100000",
    validation: { min: 10000, max: 1000000 },
    unit: "байт",
  },
  {
    key: "user_files_max_name_length",
    label: "Макс. длина имени файла",
    description:
      "Максимальная длина названия пользовательского файла",
    category: "files_storage",
    type: "number",
    defaultValue: "100",
    validation: { min: 20, max: 500 },
    unit: "символов",
  },
  {
    key: "user_files_max_description_length",
    label: "Макс. длина описания файла",
    description:
      "Максимальная длина описания пользовательского файла",
    category: "files_storage",
    type: "number",
    defaultValue: "500",
    validation: { min: 100, max: 2000 },
    unit: "символов",
  },
  {
    key: "fix_code_max_code_bytes",
    label: "Макс. размер кода для исправления",
    description:
      "Максимальный размер кода для функции fix-code (500 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "512000",
    validation: { min: 10000, max: 5000000 },
    unit: "байт",
  },
  {
    key: "fix_code_max_error_bytes",
    label: "Макс. размер ошибки для исправления",
    description:
      "Максимальный размер текста ошибки для fix-code (10 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "10240",
    validation: { min: 1024, max: 100000 },
    unit: "байт",
  },

  // ═══════════════════════════════════════════════════════════════
  // swarm (3)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "swarm_classify_timeout_ms",
    label: "Таймаут классификации",
    description:
      "Время ожидания LLM при классификации запроса мультиагентом. Увеличьте при медленных моделях",
    category: "swarm",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "swarm_consult_timeout_ms",
    label: "Таймаут консультации агента",
    description:
      "Время ожидания ответа от агента-специалиста в мультиагенте",
    category: "swarm",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "swarm_consult_max_tool_turns",
    label: "Макс. tool-итераций консультации",
    description:
      "Количество итераций tool-loop при консультации агентом. Больше = точнее, но дольше",
    category: "swarm",
    type: "number",
    defaultValue: "2",
    validation: { min: 1, max: 10 },
    unit: "шт.",
  },

  // ═══════════════════════════════════════════════════════════════
  // webhooks (2)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "webhook_max_attempts",
    label: "Макс. попыток доставки",
    description:
      "Количество попыток отправки вебхука. При неудаче — экспоненциальный backoff",
    category: "webhooks",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 10 },
    unit: "шт.",
  },
  {
    key: "webhook_timeout_ms",
    label: "Таймаут вебхука",
    description:
      "Время ожидания ответа от URL вебхука при каждой попытке",
    category: "webhooks",
    type: "number",
    defaultValue: "10000",
    validation: { min: 1000, max: 60000 },
    unit: "мс",
  },

  // ═══════════════════════════════════════════════════════════════
  // billing (9)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "billing_default_currency",
    label: "Валюта по умолчанию",
    description: "Валюта для отображения цен и биллинга",
    category: "billing",
    type: "string",
    defaultValue: "USD",
    validation: { allowedValues: ["USD", "KZT", "EUR", "RUB"] },
  },
  {
    key: "billing_expiry_warning_days",
    label: "Дни предупреждения",
    description:
      "За сколько дней до окончания подписки отправлять уведомление пользователю",
    category: "billing",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 30 },
    unit: "дней",
  },
  {
    key: "stripe_secret_key",
    label: "Stripe Secret Key",
    description:
      "Секретный ключ Stripe API (sk_live_... или sk_test_...). Перезаписывает переменную STRIPE_SECRET_KEY",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "stripe_webhook_secret",
    label: "Stripe Webhook Secret",
    description:
      "Секрет для проверки подписи вебхуков Stripe (whsec_...). Перезаписывает переменную STRIPE_WEBHOOK_SECRET",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "freedom_pay_merchant_id",
    label: "Freedom Pay Merchant ID",
    description:
      "Числовой ID мерчанта в Freedom Pay. Перезаписывает переменную FREEDOM_PAY_MERCHANT_ID",
    category: "billing",
    type: "string",
    defaultValue: "",
  },
  {
    key: "freedom_pay_secret_key",
    label: "Freedom Pay Secret Key",
    description:
      "Секретный ключ мерчанта Freedom Pay для подписи запросов. Перезаписывает переменную FREEDOM_PAY_SECRET_KEY",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "freedom_pay_testing_mode",
    label: "Freedom Pay тестовый режим",
    description:
      "Включить тестовый режим Freedom Pay (1 = тест, 0 = прод). Перезаписывает переменную FREEDOM_PAY_TESTING_MODE",
    category: "billing",
    type: "string",
    defaultValue: "0",
    validation: { allowedValues: ["0", "1"] },
  },

  // ═══════════════════════════════════════════════════════════════
  // pagination (6)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "pagination_default_limit",
    label: "Лимит по умолчанию",
    description:
      "Количество элементов на странице по умолчанию во всех списковых API",
    category: "pagination",
    type: "number",
    defaultValue: "50",
    validation: { min: 5, max: 200 },
    unit: "шт.",
  },
  {
    key: "pagination_max_limit",
    label: "Макс. лимит страницы",
    description:
      "Максимальное количество элементов на странице, которое может запросить клиент",
    category: "pagination",
    type: "number",
    defaultValue: "100",
    validation: { min: 10, max: 1000 },
    unit: "шт.",
  },
  {
    key: "csv_export_max_rows",
    label: "Макс. строк CSV экспорта",
    description:
      "Максимальное количество строк при экспорте данных в CSV из админки",
    category: "pagination",
    type: "number",
    defaultValue: "10000",
    validation: { min: 100, max: 1000000 },
    unit: "шт.",
  },
  {
    key: "pagination_conversations_max",
    label: "Макс. диалогов на страницу",
    description:
      "Максимальное количество диалогов, возвращаемых за один запрос",
    category: "pagination",
    type: "number",
    defaultValue: "200",
    validation: { min: 10, max: 1000 },
    unit: "шт.",
  },
  {
    key: "pagination_tasks_max",
    label: "Макс. задач на страницу",
    description:
      "Максимальное количество задач, возвращаемых за один запрос",
    category: "pagination",
    type: "number",
    defaultValue: "200",
    validation: { min: 10, max: 1000 },
    unit: "шт.",
  },
  {
    key: "pagination_memory_max",
    label: "Макс. записей памяти на страницу",
    description:
      "Максимальное количество записей памяти, возвращаемых за один запрос",
    category: "pagination",
    type: "number",
    defaultValue: "200",
    validation: { min: 10, max: 1000 },
    unit: "шт.",
  },

  // ═══════════════════════════════════════════════════════════════
  // email (6)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "smtp_host",
    label: "SMTP хост",
    description:
      "Адрес SMTP сервера (например smtp.gmail.com). Перезаписывает переменную SMTP_HOST",
    category: "email",
    type: "string",
    defaultValue: "",
  },
  {
    key: "email_default_smtp_port",
    label: "SMTP порт",
    description:
      "Порт SMTP сервера по умолчанию (587 = STARTTLS, 465 = SSL)",
    category: "email",
    type: "number",
    defaultValue: "587",
    validation: { min: 1, max: 65535 },
  },
  {
    key: "smtp_user",
    label: "SMTP пользователь",
    description:
      "Email/логин для авторизации на SMTP сервере. Перезаписывает переменную SMTP_USER",
    category: "email",
    type: "string",
    defaultValue: "",
  },
  {
    key: "smtp_password",
    label: "SMTP пароль",
    description:
      "Пароль (App Password) для SMTP авторизации. Перезаписывает переменную SMTP_PASS",
    category: "email",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "email_default_from",
    label: "Email отправителя",
    description:
      "Email адрес, от имени которого отправляются письма (например Sanbao <user@gmail.com>)",
    category: "email",
    type: "string",
    defaultValue: "noreply@sanbao.ai",
  },
  {
    key: "smtp_from",
    label: "Имя отправителя",
    description:
      "Полное имя отправителя с email (например: Sanbao <noreply@sanbao.ai>). Перезаписывает переменную SMTP_FROM",
    category: "email",
    type: "string",
    defaultValue: "",
  },

  // ═══════════════════════════════════════════════════════════════
  // timeouts (5)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "llm_timeout_ms",
    label: "Таймаут LLM",
    description:
      "Общий таймаут LLM-вызовов (заголовки, генерация названия и т.д.)",
    category: "timeouts",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 120000 },
    unit: "мс",
  },
  {
    key: "provider_test_timeout_ms",
    label: "Таймаут теста провайдера",
    description:
      "Таймаут при проверке доступности AI-провайдера в админке",
    category: "timeouts",
    type: "number",
    defaultValue: "10000",
    validation: { min: 3000, max: 60000 },
    unit: "мс",
  },
  {
    key: "health_check_timeout_ms",
    label: "Таймаут health-check",
    description:
      "Таймаут health-check запросов к внешним сервисам (Redis, MCP)",
    category: "timeouts",
    type: "number",
    defaultValue: "5000",
    validation: { min: 1000, max: 30000 },
    unit: "мс",
  },
  {
    key: "ai_cortex_timeout_default_ms",
    label: "Таймаут AI Cortex (по умолчанию)",
    description:
      "Таймаут стандартных запросов к AI Cortex (создание, получение, удаление). Влияет на все cortexFetch-вызовы без явного timeout",
    category: "timeouts",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 120000 },
    unit: "мс",
  },
  {
    key: "ai_cortex_timeout_process_ms",
    label: "Таймаут AI Cortex (обработка)",
    description:
      "Таймаут длительных операций AI Cortex: обработка проекта, публикация. Выше из-за объёмных pipeline-задач",
    category: "timeouts",
    type: "number",
    defaultValue: "120000",
    validation: { min: 30000, max: 600000 },
    unit: "мс",
  },

  // ═══════════════════════════════════════════════════════════════
  // integrations (2)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "integration_discovery_timeout_ms",
    label: "Таймаут обнаружения 1С",
    description:
      "Таймаут обнаружения OData каталога при подключении к 1С",
    category: "integrations",
    type: "number",
    defaultValue: "15000",
    validation: { min: 5000, max: 120000 },
    unit: "мс",
  },
  {
    key: "integration_odata_catalog_max_chars",
    label: "Макс. символов каталога OData",
    description:
      "Максимальная длина текста каталога OData для отображения пользователю",
    category: "integrations",
    type: "number",
    defaultValue: "8000",
    validation: { min: 2000, max: 50000 },
    unit: "символов",
  },

  // ═══════════════════════════════════════════════════════════════
  // redis (4)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "redis_max_retries_per_request",
    label: "Макс. повторов на запрос",
    description:
      "Количество повторных попыток Redis-операции при сбое",
    category: "redis",
    type: "number",
    defaultValue: "3",
    validation: { min: 0, max: 10 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "redis_retry_max_attempts",
    label: "Макс. попыток реконнекта",
    description:
      "Максимальное количество попыток переподключения к Redis",
    category: "redis",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 20 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "redis_retry_max_delay_ms",
    label: "Макс. задержка реконнекта",
    description:
      "Максимальная задержка между попытками переподключения к Redis",
    category: "redis",
    type: "number",
    defaultValue: "2000",
    validation: { min: 500, max: 30000 },
    unit: "мс",
    restartRequired: true,
  },
  {
    key: "redis_connect_timeout_ms",
    label: "Таймаут подключения Redis",
    description:
      "Время ожидания подключения к Redis при старте",
    category: "redis",
    type: "number",
    defaultValue: "5000",
    validation: { min: 1000, max: 30000 },
    unit: "мс",
    restartRequired: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // misc (2)
  // ═══════════════════════════════════════════════════════════════
  {
    key: "max_auto_fix_attempts",
    label: "Макс. попыток авто-исправления",
    description:
      "Количество попыток автоматического исправления ошибок в коде",
    category: "misc",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 10 },
    unit: "шт.",
  },
  {
    key: "slug_max_length",
    label: "Макс. длина slug",
    description:
      "Максимальная длина URL-slug для агентов и навыков",
    category: "misc",
    type: "number",
    defaultValue: "60",
    validation: { min: 20, max: 200 },
    unit: "символов",
  },
];

// ─── O(1) lookup map ───

export const SETTINGS_MAP: Map<string, SettingDefinition> = new Map(
  SETTINGS_REGISTRY.map((s) => [s.key, s]),
);
