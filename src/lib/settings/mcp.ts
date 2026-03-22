/**
 * MCP server settings — connection, pool, timeouts, logging.
 */

import type { SettingDefinition } from "./types";

export const MCP_SETTINGS: SettingDefinition[] = [
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
];
