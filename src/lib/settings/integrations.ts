/**
 * Integration settings — 1C, OData discovery.
 */

import type { SettingDefinition } from "./types";

export const INTEGRATIONS_SETTINGS: SettingDefinition[] = [
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
];
