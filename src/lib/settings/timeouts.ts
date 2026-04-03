/**
 * Timeout settings — LLM, provider tests, health checks, AI Cortex.
 */

import type { SettingDefinition } from "./types";

export const TIMEOUTS_SETTINGS: SettingDefinition[] = [
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
    key: "llm_stream_call_timeout_ms",
    label: "Таймаут LLM (стрим, за итерацию)",
    description:
      "Таймаут каждого LLM-вызова внутри tool-call loop. После вызова инструмента модель может думать долго — этот таймаут должен быть щедрым.",
    category: "timeouts",
    type: "number",
    defaultValue: "120000",
    validation: { min: 30000, max: 300000 },
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
];
