/**
 * Rate-limiting settings — violations, blocks, per-endpoint limits.
 */

import type { SettingDefinition } from "./types";

export const RATE_LIMITING_SETTINGS: SettingDefinition[] = [
  {
    key: "rate_violation_threshold",
    label: "Порог нарушений для блокировки",
    description:
      "Количество нарушений лимита в окне, после которого пользователь автоматически блокируется",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 3, max: 100 },
    unit: "шт.",
  },
  {
    key: "rate_violation_window_ms",
    label: "Окно подсчёта нарушений",
    description:
      "Временное окно для подсчёта нарушений (по умолчанию 5 минут). Нарушения старше окна сбрасываются",
    category: "rate_limiting",
    type: "number",
    defaultValue: "300000",
    validation: { min: 60000, max: 3600000 },
    unit: "мс",
  },
  {
    key: "rate_user_block_duration_ms",
    label: "Длительность блокировки",
    description:
      "Время блокировки пользователя за превышение порога нарушений (по умолчанию 30 минут)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "1800000",
    validation: { min: 60000, max: 86400000 },
    unit: "мс",
  },
  {
    key: "rate_auth_max_per_minute",
    label: "Попыток авторизации в минуту",
    description:
      "Максимум попыток логина/регистрации с одного IP в минуту. Защита от брутфорса",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 60 },
    unit: "шт./мин",
  },
  {
    key: "rate_auth_block_duration_ms",
    label: "Блокировка IP за авторизацию",
    description:
      "Длительность блокировки IP при превышении лимита попыток авторизации (по умолчанию 15 мин)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "900000",
    validation: { min: 60000, max: 86400000 },
    unit: "мс",
  },
  {
    key: "rate_cache_cleanup_interval_ms",
    label: "Интервал очистки кеша лимитов",
    description:
      "Как часто очищаются устаревшие записи in-memory таблицы лимитов (по умолчанию 5 мин)",
    category: "rate_limiting",
    type: "number",
    defaultValue: "300000",
    validation: { min: 30000, max: 3600000 },
    unit: "мс",
    restartRequired: true,
  },
  {
    key: "rate_agent_gen_per_minute",
    label: "Лимит генерации агентов/мин",
    description:
      "Максимум запросов генерации агентов в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_skill_gen_per_minute",
    label: "Лимит генерации навыков/мин",
    description:
      "Максимум запросов генерации навыков в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_skill_quick_per_minute",
    label: "Лимит быстрого создания навыков/мин",
    description:
      "Максимум запросов быстрого создания навыков в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_2fa_per_minute",
    label: "Лимит попыток 2FA/мин",
    description:
      "Максимум попыток ввода кода 2FA в минуту. Защита от перебора TOTP-кодов",
    category: "rate_limiting",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_admin_per_minute",
    label: "Лимит админ-запросов/мин",
    description:
      "Максимум запросов к админ-API в минуту на администратора",
    category: "rate_limiting",
    type: "number",
    defaultValue: "60",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
  {
    key: "rate_fix_code_per_minute",
    label: "Лимит исправления кода/мин",
    description:
      "Максимум запросов на исправление кода в минуту на пользователя",
    category: "rate_limiting",
    type: "number",
    defaultValue: "20",
    validation: { min: 1, max: 120 },
    unit: "шт./мин",
  },
];
