/**
 * Security & auth settings — passwords, sessions, tokens, invites.
 */

import type { SettingDefinition } from "./types";

export const AUTH_SETTINGS: SettingDefinition[] = [
  {
    key: "auth_bcrypt_rounds",
    label: "Раунды bcrypt",
    description:
      "Количество раундов хеширования паролей. Больше = безопаснее, но регистрация/логин медленнее. 12 = ~250мс",
    category: "security_auth",
    type: "number",
    defaultValue: "12",
    validation: { min: 8, max: 16 },
  },
  {
    key: "auth_password_min_length",
    label: "Мин. длина пароля",
    description:
      "Минимальная длина пароля при регистрации. Короткие пароли легче взломать",
    category: "security_auth",
    type: "number",
    defaultValue: "8",
    validation: { min: 6, max: 32 },
    unit: "символов",
  },
  {
    key: "auth_session_ttl_hours",
    label: "TTL сессии",
    description:
      "Время жизни сессии пользователя. 720 часов = 30 дней. По истечении — требуется повторный вход",
    category: "security_auth",
    type: "number",
    defaultValue: "720",
    validation: { min: 1, max: 8760 },
    unit: "часов",
  },
  {
    key: "auth_session_cache_ttl_ms",
    label: "TTL кеша сессии",
    description:
      "Время жизни локального кеша TTL сессии. Чем меньше — тем быстрее применяются изменения настройки session_ttl_hours, но чаще запросы к БД",
    category: "security_auth",
    type: "number",
    defaultValue: "300000",
    validation: { min: 30000, max: 1800000 },
    unit: "мс",
  },
  {
    key: "auth_mobile_access_token_expiry_s",
    label: "TTL мобильного токена",
    description:
      "Время жизни access-токена мобильного приложения. Короче = безопаснее, длиннее = удобнее",
    category: "security_auth",
    type: "number",
    defaultValue: "3600",
    validation: { min: 300, max: 86400 },
    unit: "сек",
  },
  {
    key: "auth_refresh_token_expiry_s",
    label: "TTL refresh-токена",
    description:
      "Время жизни refresh-токена мобильного приложения. 2592000 = 30 дней",
    category: "security_auth",
    type: "number",
    defaultValue: "2592000",
    validation: { min: 86400, max: 31536000 },
    unit: "сек",
  },
  {
    key: "auth_password_max_length",
    label: "Макс. длина пароля",
    description:
      "Максимальная длина пароля при регистрации. Защита от DoS при хешировании",
    category: "security_auth",
    type: "number",
    defaultValue: "128",
    validation: { min: 64, max: 1024 },
    unit: "символов",
  },
  {
    key: "auth_name_max_length",
    label: "Макс. длина имени",
    description:
      "Максимальная длина имени пользователя при регистрации",
    category: "security_auth",
    type: "number",
    defaultValue: "100",
    validation: { min: 20, max: 500 },
    unit: "символов",
  },
  {
    key: "auth_invite_expiry_days",
    label: "Срок действия приглашения",
    description:
      "Количество дней, в течение которых действует ссылка-приглашение в организацию",
    category: "security_auth",
    type: "number",
    defaultValue: "7",
    validation: { min: 1, max: 30 },
    unit: "дней",
  },
];
