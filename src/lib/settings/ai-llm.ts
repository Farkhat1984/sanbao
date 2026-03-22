/**
 * AI / LLM settings — temperature, tokens, context window, providers.
 */

import type { SettingDefinition } from "./types";

export const AI_LLM_SETTINGS: SettingDefinition[] = [
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
];
