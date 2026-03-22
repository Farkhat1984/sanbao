/**
 * Context & chat settings — compaction, message limits, attachments.
 */

import type { SettingDefinition } from "./types";

export const CONTEXT_CHAT_SETTINGS: SettingDefinition[] = [
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
];
