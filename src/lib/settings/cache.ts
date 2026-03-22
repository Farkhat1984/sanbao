/**
 * Cache settings — TTLs, L1/L2 sizes, bounded map limits.
 */

import type { SettingDefinition } from "./types";

export const CACHE_SETTINGS: SettingDefinition[] = [
  {
    key: "cache_ttl_ms",
    label: "TTL общего кеша",
    description:
      "Время жизни in-memory кеша (модели, фильтры, IP). Меньше = свежее данные, больше = меньше нагрузка на БД",
    category: "cache",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 600000 },
    unit: "мс",
  },
  {
    key: "cache_agent_context_ttl_ms",
    label: "TTL контекста агента (L1)",
    description:
      "Время жизни L1 кеша контекста агента в памяти. При изменении агента — ждать до TTL",
    category: "cache",
    type: "number",
    defaultValue: "30000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "cache_agent_context_redis_ttl_s",
    label: "TTL контекста агента (L2 Redis)",
    description:
      "Время жизни L2 кеша контекста агента в Redis. Должен быть >= L1 TTL",
    category: "cache",
    type: "number",
    defaultValue: "60",
    validation: { min: 10, max: 600 },
    unit: "сек",
  },
  {
    key: "cache_plan_ttl_s",
    label: "TTL кеша плана",
    description:
      "Время жизни кеша данных плана пользователя в Redis. Низкий TTL для актуальности лимитов",
    category: "cache",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 60 },
    unit: "сек",
  },
  {
    key: "cache_agent_context_max_entries",
    label: "Макс. записей кеша агентов",
    description:
      "Размер BoundedMap для кеша контекста агентов в памяти",
    category: "cache",
    type: "number",
    defaultValue: "200",
    validation: { min: 50, max: 1000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_model_router_max_entries",
    label: "Макс. записей кеша моделей",
    description:
      "Размер BoundedMap для кеша роутера моделей в памяти",
    category: "cache",
    type: "number",
    defaultValue: "200",
    validation: { min: 50, max: 1000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_rate_limit_max_entries",
    label: "Макс. записей лимитов",
    description:
      "Размер BoundedMap для хранения данных rate-limit в памяти",
    category: "cache",
    type: "number",
    defaultValue: "50000",
    validation: { min: 10000, max: 500000 },
    unit: "шт.",
    restartRequired: true,
  },
  {
    key: "cache_system_agents_ttl_ms",
    label: "TTL кеша системных агентов",
    description:
      "Время жизни кеша списка системных агентов. При добавлении/удалении системного агента — ждать до TTL",
    category: "cache",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 600000 },
    unit: "мс",
  },
];
