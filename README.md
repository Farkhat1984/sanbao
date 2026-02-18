# Sanbao — универсальный AI-ассистент

Универсальная AI-платформа с модульной иерархией Agent → Plugin → Skill → Tool → MCP. Всё управляется из админки: системные агенты, инструменты с шаблонами, плагины, навыки, MCP-серверы.

## Стек

- **Frontend:** Next.js 16.1 (App Router), React 19 (React Compiler), Tailwind CSS v4, Zustand, Framer Motion, Tiptap v3
- **Backend:** Next.js API Routes (105 route-файлов), Prisma ORM (55 моделей), BullMQ (job queues)
- **AI:** Vercel AI SDK (OpenAI, Anthropic), Moonshot API (Kimi K2.5), MCP Protocol, 14 нативных инструментов
- **Database:** PostgreSQL 16 + PgBouncer (connection pooling) + Prisma read replicas
- **Cache / Queue:** Redis 7 (ioredis) + BullMQ
- **Auth:** NextAuth v5 (JWT, Credentials + Google OAuth, 2FA TOTP)
- **Billing:** Stripe + Freedom Pay (Checkout, Webhooks, промокоды)
- **Storage:** S3/MinIO (файлы, аватары)
- **Monitoring:** Prometheus + Grafana + Alertmanager + Sentry
- **Infra:** Docker, Kubernetes (HPA, PDB, canary), Nginx, GitHub Actions CI/CD
- **i18n:** Русский (основной), Қазақша (Kazakh)

---

## Быстрый старт (разработка)

```bash
# 1. Клонировать и установить зависимости
git clone <repo-url> && cd sanbao
npm install

# 2. Настроить окружение
cp .env.example .env
# Заполнить: DATABASE_URL, NEXTAUTH_SECRET, API-ключи провайдеров

# 3. Настроить БД
npx prisma generate
npx prisma db push
npx prisma db seed

# 4. Запустить
npm run dev    # http://localhost:3000
```

Или через Docker:

```bash
docker compose up --build    # http://localhost:3004
```

---

## Развертывание

Подробное руководство по развертыванию — см. [`DEPLOY.md`](DEPLOY.md).

### Вариант 1: Docker Compose (один сервер, до ~10K пользователей)

```bash
cp .env.example .env         # заполнить секреты
docker compose up --build -d
```

Поднимает: PostgreSQL + PgBouncer + Redis + App на порту 3004.

### Вариант 2: Docker Compose Production (один сервер, до ~50K пользователей)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Добавляет:
- **Nginx** — load balancer (least_conn), rate limiting (30r/s общий, 10r/s chat), SSE support
- **3 реплики** приложения (масштабируется через `--scale app=N`)
- Tuned PostgreSQL (`shared_buffers=1GB, effective_cache_size=3GB`)
- PgBouncer (`MAX_CLIENT_CONN=1000, pool=50`)

### Вариант 3: Kubernetes (100K+ пользователей)

Полное cloud-native развертывание с автоскейлингом. См. [`DEPLOY.md`](DEPLOY.md) для подробностей.

---

## CI/CD (GitHub Actions)

3 workflow-файла:

- **CI** (`ci.yml`): lint, type-check, unit tests, Docker build test — на каждый PR
- **Deploy K8s** (`deploy.yml`): build image → push → миграции → rolling deploy — на push в main
- **Deploy Server** (`deploy-server.yml`): SSH деплой на 2 сервера → healthcheck → Telegram уведомление

### Настройка

GitHub Secrets:

| Secret | Значение |
|--------|----------|
| `REGISTRY_TOKEN` | Токен Docker registry |
| `KUBE_CONFIG` | base64-encoded kubeconfig |

GitHub Variables:

| Variable | Значение |
|----------|----------|
| `REGISTRY_URL` | URL registry (по умолчанию `ghcr.io`) |

---

## Переменные окружения

### Обязательные

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL (через PgBouncer): `?pgbouncer=true` |
| `DIRECT_DATABASE_URL` | PostgreSQL (напрямую, для миграций) |
| `NEXTAUTH_URL` | URL приложения |
| `NEXTAUTH_SECRET` | Секрет NextAuth (random 32+ символов) |
| `ADMIN_PASSWORD` | Пароль админ-панели |

### AI провайдеры (хотя бы один)

| Переменная | Описание |
|------------|----------|
| `MOONSHOT_API_KEY` | Kimi K2.5 (дефолтный TEXT-провайдер) |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `DEEPINFRA_API_KEY` | DeepInfra (IMAGE-провайдер: Flux Schnell, Qwen Image Edit) |

### Инфраструктура

| Переменная | Описание | По умолчанию |
|------------|----------|:------------:|
| `REDIS_URL` | Redis connection string | — |
| `DATABASE_REPLICA_URL` | Read replica (опционально) | — |
| `CDN_URL` | CDN для `_next/static` | — |
| `SHUTDOWN_DRAIN_MS` | Время drain при shutdown (мс) | `15000` |
| `CRON_SECRET` | Секрет для CRON-эндпоинтов | — |
| `LOG_FORMAT` | `json` / `text` | `json` в prod |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` | `info` в prod |

### Сервисы

| Переменная | Описание |
|------------|----------|
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | S3/MinIO хранилище |
| `S3_BACKUP_BUCKET` | S3 бакет для бэкапов |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe биллинг |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email (Nodemailer) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth |
| `ENCRYPTION_KEY` | AES-256-GCM для API-ключей |
| `ADMIN_IP_WHITELIST` | IP-адреса для доступа к админке |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Sentry project для source maps |

---

## Архитектура

```
                     ┌──────────┐
                     │  Nginx   │  LB + rate limit + TLS
                     └────┬─────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
      ┌────┴───┐    ┌────┴───┐    ┌────┴───┐
      │ App #1 │    │ App #2 │    │ App #3 │  Next.js + BullMQ workers
      └────┬───┘    └────┬───┘    └────┬───┘
           │             │             │
  ┌────────┴─────────────┴─────────────┴────────┐
  │                                             │
┌─┴───────┐                              ┌─────┴──┐
│PgBouncer│                              │ Redis  │  cache, rate-limit, queues
└─┬───────┘                              └────────┘
  │
┌─┴────────┐      ┌──────────┐
│PostgreSQL │─────▶│ Replica  │  read-only (опционально)
└──────────┘      └──────────┘
```

---

## Функционал

### Чат и AI
- Мультипровайдер: Kimi K2.5, OpenAI, Anthropic, DeepInfra — динамическая маршрутизация из БД
- NDJSON-стриминг, markdown, подсветка кода, reasoning mode
- Веб-поиск, автокомпакция контекста, пользовательская память
- MCP-серверы (глобальные и пользовательские)
- A/B тестирование промптов, фильтр контента

### Агенты, инструменты, плагины
- **Агенты**: системные (из админки) и пользовательские с файлами-контекстом
- **Инструменты**: типы PROMPT_TEMPLATE, WEBHOOK, URL, FUNCTION + шаблоны форм
- **Навыки**: промпт + правила цитирования + юрисдикция, маркетплейс
- **Плагины**: пакеты из tools + skills + MCP-серверов
- **14 нативных инструментов**: HTTP, задачи, память, уведомления, калькулятор, CSV, графики, знания

### Панель артефактов
- Табовая система: артефакты + документы в одной панели (UnifiedPanel)
- Просмотр / редактирование (Tiptap) / исходник
- Экспорт в DOCX, XLSX, PDF, TXT, HTML

### Биллинг
- Stripe Checkout + Freedom Pay с промокодами и пробным периодом
- Webhook: автоназначение подписки, invoice-email, downgrade
- Тарифные планы с гранулярными лимитами (сообщения/день, токены, инструменты)
- PDF-инвойсы с QR-кодами

### Безопасность
- 2FA TOTP, IP whitelist для админки
- Rate limiting: Redis-first + in-memory fallback, auto-block при abuse
- Input validation, SSRF protection, timing-safe comparison
- CSP, HSTS, X-Frame-Options, stream buffer cap
- API-ключи: AES-256-GCM шифрование

### Админ-панель (`/admin`)
29 страниц управления. Подробности в [ADMINGUIDE.md](docs/ADMINGUIDE.md).

---

## Мониторинг

| Endpoint | Назначение |
|----------|-----------|
| `GET /api/health` | Health check: DB, Redis, AI providers, MCP. 503 при shutdown |
| `GET /api/ready` | Readiness probe: DB SELECT 1 + Redis ping |
| `GET /api/metrics` | Prometheus-совместимые метрики |

### Метрики Prometheus

- Бизнес: `sanbao_users_total`, `sanbao_active_users_today`, `sanbao_messages_today`, `sanbao_tokens_today`
- Ошибки: `sanbao_errors_1h`
- Провайдеры: `sanbao_provider_requests_total{provider}`, `sanbao_provider_cost_total{provider}`
- Redis: `sanbao_redis_connected`, `sanbao_redis_memory_bytes`, `sanbao_redis_keys`
- Процесс: `process_heap_bytes{type}`, `process_uptime_seconds`, `process_cpu_microseconds{type}`
- Latency: `sanbao_request_duration_ms_bucket{route,le}` (histogram)

### Алерты

| Алерт | Условие | Severity |
|-------|---------|----------|
| HighErrorRate | > 50 ошибок/час | critical |
| RedisDown | Redis disconnected 2+ мин | critical |
| HighMemory | RSS > 1.5GB 5+ мин | warning |
| HighCPU | CPU > 800k μs/5мин | warning |
| PodRestarts | > 3 рестарта/час | warning |

---

## Нагрузочное тестирование

```bash
# Установить k6: https://k6.io/docs/get-started/installation/

# Полный flow (register → login → chat SSE → list)
k6 run --env BASE_URL=https://sanbao.example.com tests/load/chat-flow.js

# Проверка rate limiter
k6 run tests/load/rate-limit.js

# Стресс-тест (рамп до 5000 VU)
k6 run tests/load/stress.js
```

---

## Структура проекта

```
sanbao/
├── .github/workflows/     CI/CD (ci.yml, deploy.yml, deploy-server.yml)
├── docs/                  Документация (8 файлов)
│   ├── DEVOPS.md          Серверы, порты, CI/CD, troubleshooting
│   ├── STYLEGUIDE.md      Дизайн-система
│   ├── ADMINGUIDE.md      Руководство администратора
│   ├── USERGUIDE.md       Руководство пользователя
│   ├── ADVERTISING.md     Система рекламы
│   ├── FRAGMENTDB_PIPELINE.md  Интеграция FragmentDB
│   └── HOTFIX*.md         Исторические фиксы
├── infra/                 Инфраструктура
│   ├── k8s/               Kubernetes manifests (14 файлов)
│   │   ├── monitoring/    Prometheus + Grafana + Alertmanager
│   │   ├── app-deployment.yml
│   │   ├── hpa.yml        HPA (3-20 pods, CPU/mem 70%)
│   │   ├── pdb.yml        PodDisruptionBudget
│   │   ├── ingress.yml    Nginx Ingress + TLS
│   │   ├── canary-rollout.yml  Argo Rollouts
│   │   ├── network-policies.yml  6 правил
│   │   ├── backup-cronjob.yml   pg_dump → S3
│   │   └── ...
│   ├── nginx/             Nginx LB config
│   └── docker-compose.monitoring.yml
├── prisma/                Schema (55 models, 14 enums) + seed
├── scripts/
│   ├── deploy.sh          Zero-downtime deploy (168 строк)
│   ├── pg-backup.sh       PostgreSQL backup → S3
│   ├── upload-static.sh   CDN upload
│   ├── start-mcp-servers.sh  5 MCP серверов
│   └── gen-1c-catalog.ts  Генератор каталога 1C
├── src/
│   ├── app/               Next.js App Router
│   │   ├── (app)/         Основное приложение (13 страниц)
│   │   ├── (auth)/        Аутентификация (login, register)
│   │   ├── (admin)/admin/ Админ-панель (29 страниц)
│   │   ├── (legal)/       Юридические страницы (terms, privacy, offer)
│   │   └── api/           API-роуты (105 файлов)
│   ├── components/        React-компоненты (17 директорий, 69 файлов)
│   ├── hooks/             useIsMobile, useTranslation
│   ├── lib/               Бизнес-логика
│   │   ├── chat/          Стриминг (moonshot-stream, ai-sdk-stream, message-builder)
│   │   ├── native-tools/  14 встроенных AI-инструментов
│   │   ├── redis.ts       Redis client (graceful degradation)
│   │   ├── queue.ts       BullMQ queues (inline fallback)
│   │   ├── workers.ts     Job processors (webhook, email)
│   │   ├── shutdown.ts    Graceful shutdown
│   │   ├── logger.ts      Structured JSON logger
│   │   ├── rate-limit.ts  Redis-first rate limiting
│   │   ├── freedom-pay.ts Freedom Pay integration
│   │   ├── invoice.ts     PDF invoices с QR
│   │   ├── i18n.ts        Локализация (ru/kk)
│   │   ├── export-*.ts    Экспорт (DOCX, XLSX, PDF)
│   │   └── ...            ~50 модулей
│   ├── messages/          Локализация (ru.json, kk.json)
│   ├── stores/            11 Zustand stores
│   └── instrumentation.ts Worker bootstrap
├── tests/
│   ├── e2e/               E2E-тесты API (3 файла)
│   └── load/              k6 нагрузочные тесты (3 файла)
├── docker-compose.yml     Dev (DB + PgBouncer + Redis + App)
├── docker-compose.prod.yml  Prod (+ Nginx + 3 replicas)
├── Dockerfile             Multi-stage production build
├── DEPLOY.md              Руководство по деплою
└── sentry.*.config.ts     Sentry error tracking
```

---

## Команды

```bash
npm run dev              # Dev server
npm run build            # Production build (standalone)
npm run start            # Start production server
npm run lint             # ESLint
npm run test             # Vitest unit tests

npx prisma generate      # Regenerate Prisma client
npx prisma db push       # Sync schema (dev)
npx prisma migrate deploy  # Apply migrations (prod)
npx prisma db seed       # Seed data
npx prisma studio        # Visual DB browser
```

---

## Документация

- [DEPLOY.md](DEPLOY.md) — руководство по деплою
- [CLAUDE.md](CLAUDE.md) — контекст для Claude Code
- [docs/DEVOPS.md](docs/DEVOPS.md) — DevOps: серверы, порты, CI/CD
- [docs/STYLEGUIDE.md](docs/STYLEGUIDE.md) — дизайн-система (Soft Corporate Minimalism)
- [docs/USERGUIDE.md](docs/USERGUIDE.md) — руководство пользователя
- [docs/ADMINGUIDE.md](docs/ADMINGUIDE.md) — руководство администратора
