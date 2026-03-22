/**
 * Native tools settings — HTTP, CSV, knowledge search, memory limits.
 */

import type { SettingDefinition } from "./types";

export const NATIVE_TOOLS_SETTINGS: SettingDefinition[] = [
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
];
