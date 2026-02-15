# Sanbao — Руководство администратора

## Доступ

- Роль `ADMIN` назначается в БД (поле `User.role`)
- Встроенный аккаунт: логин `admin`, пароль задан в `src/lib/auth.ts`
- Для доступа к `/admin` обязательна 2FA (Google Authenticator). При первом входе — редирект на настройку
- Кнопка со щитом в сайдбаре → `/admin`

## Структура админ-панели

### Обзор (`/admin`)
Дашборд: пользователи, активность за день, сообщения, распределение по планам.

---

### Пользователи

| Страница | Описание |
|----------|----------|
| `/admin/users` | Список, поиск, смена роли, назначение плана, бан, удаление |
| `/admin/plans` | Тарифы: лимиты, цены, feature-флаги, квота хранилища (`maxStorageMb`) |
| `/admin/billing` | MRR, подписки, ручное назначение/отмена, refund |
| `/admin/promo-codes` | CRUD промокодов: скидка %, maxUses, срок действия |
| `/admin/sessions` | Активные сессии, принудительное завершение, TTL |

### AI

| Страница | Описание |
|----------|----------|
| `/admin/providers` | AI-провайдеры: CRUD, тест-запрос, шифрование ключей |
| `/admin/models` | Модели: параметры (temperature, top_p, maxTokens), thinking, стоимость |
| `/admin/models/matrix` | Матрица план × модель — какие модели доступны каким планам |
| `/admin/agents` | Системные агенты: CRUD, drag-and-drop сортировка, предпросмотр |
| `/admin/skills` | Скиллы: CRUD, модерация (approve/reject), статистика использования |
| `/admin/mcp` | Глобальные MCP-серверы: CRUD, health-check, логи вызовов инструментов |
| `/admin/experiments` | A/B тестирование промптов: варианты, трафик, impressions, рейтинг |

### Аналитика

| Страница | Описание |
|----------|----------|
| `/admin/analytics` | Графики 7/30/90 дней, топ-10 пользователей, распределение по провайдерам, финансы |
| `/admin/usage` | Детальный TokenLog: фильтры по пользователю/дате, экспорт CSV |

### Система

| Страница | Описание |
|----------|----------|
| `/admin/logs` | Аудит-лог с фильтрами, экспорт CSV |
| `/admin/errors` | Ошибки со stack trace и metadata, экспорт CSV |
| `/admin/health` | Статус БД, AI-провайдеров, MCP-серверов |
| `/admin/moderation` | Просмотр разговоров, флаги, бан |
| `/admin/agent-moderation` | Модерация публичных агентов, жалобы пользователей |
| `/admin/email` | SMTP-настройки, тестовая отправка, история EmailLog, редактирование шаблонов |
| `/admin/notifications` | Глобальные/персональные уведомления, массовая рассылка, баннеры |
| `/admin/settings` | Глобальный промпт, welcome-экран, онбординг, SMTP, логотип, IP whitelist, maintenance mode |
| `/admin/templates` | Шаблоны юридических документов: CRUD, юрисдикция |

### Интеграции

| Страница | Описание |
|----------|----------|
| `/admin/api-keys` | API-ключи: генерация, rate-limit per-key, маскирование |
| `/admin/webhooks` | Вебхуки: URL, события, секреты, логи доставки + retry |
| `/admin/files` | Файлы: статистика по пользователям, кнопка очистки orphaned файлов, ручное удаление |

---

## Ключевые настройки (SystemSetting)

Настраиваются через `/admin/settings`:

| Ключ | Описание |
|------|----------|
| `global_system_prompt` | Глобальный системный промпт для всех разговоров |
| `welcome_title`, `welcome_message` | Welcome-экран |
| `onboarding_enabled`, `onboarding_steps` | Шаги онбординга (JSON) |
| `content_filter_enabled`, `content_filter_words` | Фильтр запрещённого контента |
| `admin_ip_whitelist` | IP-адреса для доступа к админке (через запятую) |
| `session_ttl_hours` | Время жизни сессии в часах (по умолчанию 720 = 30 дней) |
| `app_name` | Название приложения |
| `app_logo` | Логотип (base64 data URL) |
| `smtp_host/port/user/pass/from` | SMTP-настройки (переопределяют env) |

## Мониторинг

### Prometheus + Grafana

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

- Prometheus: `http://localhost:9090` — скрейпит `/api/metrics`
- Grafana: `http://localhost:3001` (admin/admin) — готовый дашборд "Sanbao Overview"

### Метрики (`/api/metrics`)

users_total, active_users_today, conversations_total, messages_today, tokens_today, errors_1h, provider_requests/tokens/cost, request_duration_seconds.

### Алерты

| Алерт | Условие |
|-------|---------|
| HighErrorRate | > 10 ошибок за час |
| NoActiveUsers | 0 активных пользователей за день |
| HighTokenUsage | > 1M токенов за день |

## Безопасность

| Механизм | Описание |
|----------|----------|
| 2FA TOTP | Обязательна для ADMIN, отключение заблокировано. API: `/api/auth/2fa` |
| IP whitelist | Proxy-level (`src/proxy.ts`) + `requireAdmin()` — из env и SystemSetting |
| Rate-limit | Per-user + per-API-key. 10 нарушений за 5 мин → автоблок на 30 мин |
| Шифрование | API-ключи провайдеров — AES-256-GCM (`ENCRYPTION_KEY`) |
| Аудит | Все действия логируются в AuditLog. logAudit() в `src/lib/audit.ts` |

## Биллинг

### Stripe

1. Установите `STRIPE_SECRET_KEY` и `STRIPE_WEBHOOK_SECRET` в `.env`
2. Создайте webhook в Stripe Dashboard → URL: `https://your-domain/api/billing/webhook`
3. События: `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`

### Ручное управление

В `/admin/billing`:
- **Назначить подписку** — выберите пользователя и план
- **Отменить** — downgrade на бесплатный план
- **Возврат** — пометить платёж как REFUNDED + downgrade

### Промокоды

В `/admin/promo-codes`: код, скидка (0-100%), maxUses, срок действия, привязка к плану.

## Внешние зависимости

Код полностью готов, нужны только ключи в `.env`:

| Сервис | Переменные |
|--------|-----------|
| PostgreSQL | `DATABASE_URL` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| S3/MinIO | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Google OAuth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
