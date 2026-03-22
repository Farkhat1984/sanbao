/**
 * Files & storage settings — upload limits, S3, file parsing.
 */

import type { SettingDefinition } from "./types";

export const FILES_STORAGE_SETTINGS: SettingDefinition[] = [
  {
    key: "file_max_size_bytes",
    label: "Макс. размер файла",
    description:
      "Максимальный размер загружаемого файла (10 МБ). Увеличение требует проверки Cloudflare лимитов",
    category: "files_storage",
    type: "number",
    defaultValue: "10485760",
    validation: { min: 1048576, max: 104857600 },
    unit: "байт",
  },
  {
    key: "file_max_size_parse_bytes",
    label: "Макс. файл для парсинга",
    description:
      "Максимальный размер файла при парсинге содержимого (20 МБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "20971520",
    validation: { min: 1048576, max: 209715200 },
    unit: "байт",
  },
  {
    key: "file_max_logo_size_bytes",
    label: "Макс. размер логотипа",
    description: "Максимальный размер логотипа/аватара (512 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "524288",
    validation: { min: 51200, max: 5242880 },
    unit: "байт",
  },
  {
    key: "file_max_agent_file_bytes",
    label: "Макс. файл агента",
    description:
      "Максимальный размер файла для загрузки в агента (100 МБ). Ограничен Cloudflare",
    category: "files_storage",
    type: "number",
    defaultValue: "104857600",
    validation: { min: 1048576, max: 524288000 },
    unit: "байт",
  },
  {
    key: "file_chat_warn_chars",
    label: "Порог предупреждения",
    description:
      "Количество символов файла, при котором показывается предупреждение в чате о большом объёме",
    category: "files_storage",
    type: "number",
    defaultValue: "50000",
    validation: { min: 5000, max: 500000 },
    unit: "символов",
  },
  {
    key: "file_chat_max_chars",
    label: "Макс. символов файла в чат",
    description:
      "Жёсткий лимит символов файла для вставки в контекст. Файлы больше обрезаются",
    category: "files_storage",
    type: "number",
    defaultValue: "200000",
    validation: { min: 10000, max: 1000000 },
    unit: "символов",
  },
  {
    key: "s3_default_bucket",
    label: "S3 бакет",
    description:
      "Имя S3 бакета для хранения файлов. Изменение требует переноса данных",
    category: "files_storage",
    type: "string",
    defaultValue: "sanbao-uploads",
    restartRequired: true,
  },
  {
    key: "s3_presigned_url_expiry_s",
    label: "TTL presigned URL",
    description:
      "Время жизни предподписанной ссылки S3. После истечения — файл недоступен по ссылке",
    category: "files_storage",
    type: "number",
    defaultValue: "3600",
    validation: { min: 60, max: 86400 },
    unit: "сек",
  },
  {
    key: "user_files_max_count",
    label: "Макс. пользовательских файлов",
    description:
      "Максимальное количество текстовых файлов пользователя (без подписки)",
    category: "files_storage",
    type: "number",
    defaultValue: "20",
    validation: { min: 5, max: 200 },
    unit: "шт.",
  },
  {
    key: "user_files_max_size_bytes",
    label: "Макс. размер пользов. файла",
    description:
      "Максимальный размер одного пользовательского файла (100 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "100000",
    validation: { min: 10000, max: 1000000 },
    unit: "байт",
  },
  {
    key: "user_files_max_name_length",
    label: "Макс. длина имени файла",
    description:
      "Максимальная длина названия пользовательского файла",
    category: "files_storage",
    type: "number",
    defaultValue: "100",
    validation: { min: 20, max: 500 },
    unit: "символов",
  },
  {
    key: "user_files_max_description_length",
    label: "Макс. длина описания файла",
    description:
      "Максимальная длина описания пользовательского файла",
    category: "files_storage",
    type: "number",
    defaultValue: "500",
    validation: { min: 100, max: 2000 },
    unit: "символов",
  },
  {
    key: "fix_code_max_code_bytes",
    label: "Макс. размер кода для исправления",
    description:
      "Максимальный размер кода для функции fix-code (500 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "512000",
    validation: { min: 10000, max: 5000000 },
    unit: "байт",
  },
  {
    key: "fix_code_max_error_bytes",
    label: "Макс. размер ошибки для исправления",
    description:
      "Максимальный размер текста ошибки для fix-code (10 КБ)",
    category: "files_storage",
    type: "number",
    defaultValue: "10240",
    validation: { min: 1024, max: 100000 },
    unit: "байт",
  },
];
