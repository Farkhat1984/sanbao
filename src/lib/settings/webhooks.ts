/**
 * Webhook settings — delivery attempts, timeouts.
 */

import type { SettingDefinition } from "./types";

export const WEBHOOKS_SETTINGS: SettingDefinition[] = [
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
];
