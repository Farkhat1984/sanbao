/**
 * Pagination settings — page sizes, export limits.
 */

import type { SettingDefinition } from "./types";

export const PAGINATION_SETTINGS: SettingDefinition[] = [
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
];
