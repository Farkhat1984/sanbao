# Sanbao — универсальный AI-ассистент

Универсальная AI-платформа с модульной иерархией Agent → Plugin → Skill → Tool → MCP. Всё управляется из админки: системные агенты, инструменты с шаблонами, плагины, навыки, MCP-серверы.

## Стек

- **Frontend:** Next.js 16 (App Router), React 19 (React Compiler), Tailwind CSS v4, Zustand, Framer Motion, Tiptap
- **Backend:** Next.js API Routes, Prisma ORM, BullMQ (job queues)
- **AI:** Vercel AI SDK (OpenAI, Anthropic), Moonshot API (Kimi K2.5), MCP Protocol
- **Database:** PostgreSQL 16 + PgBouncer (connection pooling) + Prisma read replicas
- **Cache / Queue:** Redis 7 (ioredis) + BullMQ
- **Auth:** NextAuth v5 (JWT, Credentials + Google OAuth, 2FA TOTP)
- **Billing:** Stripe (Checkout, Webhooks, промокоды)
- **Storage:** S3/MinIO (файлы, аватары)
- **Monitoring:** Prometheus + Grafana + Alertmanager + Sentry
- **Infra:** Docker, Kubernetes (HPA, PDB, canary), Nginx, GitHub Actions CI/CD

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

## Развертывание в облаке

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

Полное cloud-native развертывание с автоскейлингом.

#### Предварительные требования

- Kubernetes кластер 1.28+ (Yandex Cloud / VK Cloud / AWS EKS / GKE)
- kubectl настроен
- Docker registry (GHCR / DockerHub / Yandex CR)
- Домен + DNS
- cert-manager (для автоматического TLS)

#### Развертывание

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yml

# 2. Секреты
kubectl create secret generic sanbao-secrets \
  --from-literal=DB_PASSWORD=<password> \
  --from-literal=NEXTAUTH_SECRET=<secret> \
  --from-literal=ADMIN_PASSWORD=<password> \
  --from-literal=S3_ACCESS_KEY=<key> \
  --from-literal=S3_SECRET_KEY=<key> \
  --from-literal=STRIPE_SECRET_KEY=<key> \
  --from-literal=STRIPE_WEBHOOK_SECRET=<key> \
  --from-literal=CRON_SECRET=<secret> \
  -n sanbao

# 3. ConfigMap (отредактировать домен и URLs в configmap.yml)
kubectl apply -f k8s/configmap.yml

# 4. Инфраструктура
kubectl apply -f k8s/postgres.yml
kubectl apply -f k8s/redis.yml
kubectl apply -f k8s/pgbouncer.yml

# 5. Дождаться БД
kubectl wait --for=condition=ready pod -l app=postgres -n sanbao --timeout=120s

# 6. Миграции (обновить image в migration-job.yml)
kubectl apply -f k8s/migration-job.yml
kubectl wait --for=condition=complete job/sanbao-migrate -n sanbao --timeout=120s

# 7. Приложение + автоскейлинг
kubectl apply -f k8s/app-deployment.yml
kubectl apply -f k8s/hpa.yml
kubectl apply -f k8s/pdb.yml

# 8. Ingress (отредактировать домен в ingress.yml)
kubectl apply -f k8s/ingress.yml

# 9. Network Policies (опционально)
kubectl apply -f k8s/network-policies.yml
```

#### Мониторинг

```bash
kubectl apply -f k8s/monitoring/namespace.yml
kubectl apply -f k8s/monitoring/prometheus.yml
kubectl apply -f k8s/monitoring/grafana.yml
kubectl apply -f k8s/monitoring/alertmanager.yml

# Grafana: http://<grafana-ip>:3000 (admin/admin)
# Дашборд "Sanbao Overview" загружается автоматически
```

#### Бэкапы PostgreSQL

```bash
# Ежедневный pg_dump → S3 в 03:00 UTC (хранение 30 дней)
# Добавить S3_BACKUP_BUCKET в sanbao-secrets
kubectl apply -f k8s/backup-cronjob.yml
```

#### Canary Deployments (Argo Rollouts)

```bash
# Установить Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Заменить Deployment на Rollout
kubectl delete deployment sanbao-app -n sanbao
kubectl apply -f k8s/canary-rollout.yml

# Обновление: 10% → 30% → 60% → 100% с паузами
kubectl argo rollouts set image sanbao-app app=NEW_IMAGE -n sanbao
```

---

## CI/CD (GitHub Actions)

Автоматически:
- **На PR:** lint, type-check, unit tests, Docker build test
- **На push в main:** build image → push в registry → миграции → rolling deploy

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
- Мультипровайдер: Kimi K2.5, OpenAI, Anthropic — динамическая маршрутизация из БД
- NDJSON-стриминг, markdown, подсветка кода, reasoning mode
- Веб-поиск, автокомпакция контекста, пользовательская память
- MCP-серверы (глобальные и пользовательские)
- A/B тестирование промптов, фильтр контента

### Агенты, инструменты, плагины
- **Агенты**: системные (из админки) и пользовательские с файлами-контекстом
- **Инструменты**: типы PROMPT_TEMPLATE, WEBHOOK, URL, FUNCTION + шаблоны форм
- **Навыки**: промпт + правила цитирования + юрисдикция, маркетплейс
- **Плагины**: пакеты из tools + skills + MCP-серверов
- **14 нативных инструментов**: HTTP, задачи, память, уведомления, калькулятор, CSV, графики

### Панель артефактов
- Табовая система: артефакты + документы в одной панели
- Просмотр / редактирование (Tiptap) / исходник
- Экспорт в DOCX, PDF, TXT

### Биллинг
- Stripe Checkout с промокодами и пробным периодом
- Webhook: автоназначение подписки, invoice-email, downgrade
- Тарифные планы с гранулярными лимитами

### Безопасность
- 2FA TOTP, IP whitelist для админки
- Rate limiting: Redis-first + in-memory fallback, auto-block при abuse
- Input validation, SSRF protection, timing-safe comparison
- CSP, HSTS, X-Frame-Options, stream buffer cap
- API-ключи: AES-256-GCM шифрование

### Админ-панель (`/admin`)
27+ страниц управления. Подробности в [ADMINGUIDE.md](docs/ADMINGUIDE.md).

---

## Мониторинг

| Endpoint | Назначение |
|----------|-----------|
| `GET /api/health` | Health check: DB, Redis, AI providers, MCP. 503 при shutdown |
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
| PodRestarts | > 3 рестарта/час | warning |
| SlowRequests | avg > 2s за 10 мин | warning |

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
├── .github/workflows/     CI/CD (ci.yml, deploy.yml)
├── docs/                  Документация (ADMINGUIDE, DEVOPS, STYLEGUIDE, USERGUIDE)
├── k8s/                   Kubernetes manifests
│   ├── monitoring/        Prometheus + Grafana + Alertmanager
│   ├── app-deployment.yml Deployment + Service (3 replicas)
│   ├── hpa.yml            HPA (3-20 pods, CPU 70% / mem 80%)
│   ├── pdb.yml            PodDisruptionBudget (minAvailable: 2)
│   ├── ingress.yml        Nginx Ingress + TLS
│   ├── canary-rollout.yml Argo Rollouts (10→30→60→100%)
│   ├── network-policies.yml  Default deny + allow rules
│   ├── backup-cronjob.yml pg_dump → S3 (ежедневно)
│   └── ...                postgres, redis, pgbouncer, configmap, secrets
├── nginx/                 Nginx LB config
├── prisma/                Schema + seed
├── scripts/
│   ├── pg-backup.sh       Скрипт бэкапа PostgreSQL
│   └── upload-static.sh   Загрузка статики в S3/CDN
├── src/
│   ├── app/               Next.js App Router
│   │   ├── (app)/         Основное приложение
│   │   ├── (auth)/        Аутентификация
│   │   ├── (admin)/admin/ Админ-панель (25+ страниц)
│   │   └── api/           API-роуты
│   ├── components/        React-компоненты
│   ├── hooks/             Хуки (useIsMobile, и т.д.)
│   ├── lib/               Бизнес-логика
│   │   ├── redis.ts       Redis client (graceful degradation)
│   │   ├── queue.ts       BullMQ queues (inline fallback)
│   │   ├── workers.ts     Job processors (webhook, email)
│   │   ├── shutdown.ts    Graceful shutdown (SIGTERM/SIGINT)
│   │   ├── logger.ts      Structured JSON logger
│   │   ├── rate-limit.ts  Redis-first rate limiting
│   │   ├── native-tools/  14 встроенных AI-инструментов
│   │   └── chat/          Обработка chat-стримов
│   ├── stores/            Zustand stores
│   └── instrumentation.ts Worker bootstrap
├── tests/
│   ├── e2e/               E2E-тесты API
│   └── load/              k6 нагрузочные тесты
├── docker-compose.yml     Dev (DB + PgBouncer + Redis + App)
├── docker-compose.prod.yml Prod (+ Nginx + 3 replicas)
├── Dockerfile             Multi-stage production build
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

- [STYLEGUIDE.md](docs/STYLEGUIDE.md) — дизайн-система (Soft Corporate Minimalism)
- [USERGUIDE.md](docs/USERGUIDE.md) — руководство пользователя
- [ADMINGUIDE.md](docs/ADMINGUIDE.md) — руководство администратора
- [CLAUDE.md](CLAUDE.md) — контекст для Claude Code
