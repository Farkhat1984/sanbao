/**
 * Streaming & tools settings — timeouts, buffers, tool call limits.
 */

import type { SettingDefinition } from "./types";

export const STREAMING_TOOLS_SETTINGS: SettingDefinition[] = [
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
      "Жёсткий лимит символов результата инструмента перед вставкой в контекст (~5-10K токенов)",
    category: "streaming_tools",
    type: "number",
    defaultValue: "15000",
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
];
