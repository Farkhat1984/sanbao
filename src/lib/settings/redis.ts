/**
 * Redis settings — connection retries, timeouts.
 */

import type { SettingDefinition } from "./types";

export const REDIS_SETTINGS: SettingDefinition[] = [
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
];
