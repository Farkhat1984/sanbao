# Deployment Guide

Полное руководство по развёртыванию Sanbao в продакшене.

## Содержание

- [Архитектура](#архитектура)
- [Требования](#требования)
- [Переменные окружения](#переменные-окружения)
- [Docker Compose (Dev)](#docker-compose-dev)
- [Docker Compose (Prod)](#docker-compose-prod)
- [Скрипт деплоя](#скрипт-деплоя)
- [Kubernetes](#kubernetes)
- [CI/CD](#cicd)
- [Nginx](#nginx)
- [Мониторинг](#мониторинг)
- [Бэкапы](#бэкапы)
- [Telegram-бот мониторинга](#telegram-бот-мониторинга)
- [Cloudflare Tunnel](#cloudflare-tunnel)
- [Устранение неполадок](#устранение-неполадок)

---

## Архитектура

### Двухсерверная схема

**Сервер 1 (Primary — 128.127.102.170)**
- SSH: порт 22222, пользователь `metadmin`
- Роль: основной сервер, обслуживает продакшен-трафик
- Сервисы:
  - Cloudflared (systemd, не Docker)
  - System Nginx (SSL через CF Origin Cert)
  - Docker Nginx LB (порт 3004)
  - 3 реплики Next.js (порт 3004)
  - PostgreSQL (порт 5436 → 5432)
  - PgBouncer (пул соединений)
  - Redis (кэш + очереди BullMQ)

**Сервер 2 (Standby — 46.225.122.142)**
- SSH: порт 22, пользователь `faragj`
- Роль: failover, мониторинг, MCP-серверы
- Сервисы:
  - FragmentDB (порт 8110)
  - Embedding Proxy (порт 8097)
  - MCP Orchestrator (порт 8120)
  - Telegram Monitor Bot
  - Sanbao warm standby
  - PostgreSQL standby (репликация)
  - PgBouncer, Redis
  - Cloudflared (только при failover)

### Порты

| Сервис | Внешний порт | Внутренний порт | Назначение |
|--------|-------------|----------------|------------|
| System Nginx | 443, 80 | — | SSL терминация |
| Docker Nginx | 3004 | 80 | Load balancer |
| App (×3) | — | 3004 | Next.js |
| PostgreSQL | 5436 | 5432 | База данных |
| PgBouncer | — | 5432 | Пул соединений |
| Redis | — | 6379 | Кэш + очереди |

---

## Требования

- **Node.js** 20+
- **Docker** 24+ и Docker Compose v2
- **PostgreSQL** 16
- **Redis** 7 (опционально, graceful degradation без него)
- **Cloudflare** аккаунт с настроенным Tunnel

---

## Переменные окружения

### Обязательные (Production)

| Переменная | Пример | Описание |
|-----------|--------|----------|
| `DATABASE_URL` | `postgresql://postgres:pass@pgbouncer:5432/sanbao` | Через PgBouncer |
| `DIRECT_DATABASE_URL` | `postgresql://postgres:pass@db:5432/sanbao` | Напрямую (миграции) |
| `REDIS_URL` | `redis://redis:6379` | Redis |
| `AUTH_SECRET` | base64-строка | NextAuth секрет |
| `AUTH_URL` | `https://www.sanbao.ai` | URL приложения |
| `NEXTAUTH_URL` | `https://www.sanbao.ai` | URL NextAuth |
| `NODE_ENV` | `production` | Окружение |
| `HOSTNAME` | `0.0.0.0` | Адрес сервера |
| `PORT` | `3004` | Порт приложения |

### AI-провайдеры

| Переменная | Провайдер |
|-----------|-----------|
| `MOONSHOT_API_KEY` | Kimi (K2.5) |
| `DEEPINFRA_API_KEY` | DeepInfra (FLUX, модели) |
| `OPENAI_API_KEY` | OpenAI (опционально) |
| `ANTHROPIC_API_KEY` | Anthropic (опционально) |

### Учётные данные

| Переменная | Назначение |
|-----------|------------|
| `ADMIN_PASSWORD` | Пароль админа |
| `ADMIN_EMAIL` | Email админа |
| `ADMIN_LOGIN` | Логин админа |
| `CRON_SECRET` | Авторизация cron-эндпоинтов |
| `ENCRYPTION_KEY` | AES-256-GCM ключ шифрования |

### Опциональные

| Переменная | Назначение |
|-----------|------------|
| `DATABASE_REPLICA_URL` | Read-реплика PostgreSQL |
| `STRIPE_SECRET_KEY` | Платежи Stripe |
| `STRIPE_WEBHOOK_SECRET` | Вебхуки Stripe |
| `SENTRY_DSN` | Error tracking |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Хранилище файлов |
| `S3_BUCKET` | Бакет хранилища |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Почта |
| `ADMIN_IP_WHITELIST` | Белый список IP (CSV) |
| `METRICS_TOKEN` | Bearer-токен для /api/metrics |
| `LOG_FORMAT` | `json` (prod) или `pretty` (dev) |
| `LOG_LEVEL` | `info`, `debug`, `warn`, `error` |
| `GOOGLE_SERVER_CLIENT_ID` | Google OAuth Server Client ID (audience для Android idToken) |
| `LAWYER_MCP_URL` | URL MCP Юриста (`http://orchestrator:8120/lawyer`) |
| `BROKER_MCP_URL` | URL MCP Брокера (`http://orchestrator:8120/broker`) |
| `AI_CORTEX_AUTH_TOKEN` | Токен для AI Cortex MCP (Юрист + Брокер) |

---

## Docker Compose (Dev)

```bash
# Запуск
docker compose up --build

# Сервисы: db (PostgreSQL 16), pgbouncer, redis, app
# Порт: 3004
```

Файл: `docker-compose.yml`

Конфигурация:
- PostgreSQL: 2 ГБ RAM лимит, порт 5436
- PgBouncer: transaction mode, пул 50
- Redis: 256 МБ max memory, LRU eviction
- App: 2 ГБ RAM лимит, порт 3004

---

## Docker Compose (Prod)

```bash
# Полный запуск
docker compose -f docker-compose.prod.yml up --build -d

# Только app (после изменений кода)
./scripts/deploy.sh app
```

Файл: `docker-compose.prod.yml`

Отличия от dev:
- **3 реплики** Next.js (replicas: 3)
- **Nginx LB** (least_conn алгоритм)
- PostgreSQL: 4 ГБ RAM, max_connections=200, shared_buffers=1GB
- PgBouncer: 1000 max client connections
- Redis: 512 МБ max memory
- Ресурсные лимиты на всех сервисах
- Health checks с start_period: 60s

### Dockerfile

Многоэтапная сборка (5 стадий):

1. **base** — node:20-alpine
2. **deps** — npm install + prisma generate
3. **builder** — npm run build, компиляция seed.ts
4. **prisma-cli** — standalone Prisma CLI
5. **runner** — production образ (non-root, UID 1001)

`docker-entrypoint.sh`:
1. Проверка `SKIP_MIGRATIONS`
2. `prisma migrate deploy` или `prisma db push`
3. Seed (если требуется)
4. `exec node server.js`

---

## Скрипт деплоя

Файл: `scripts/deploy.sh` — zero-downtime deploy с rolling restart.

```bash
./scripts/deploy.sh              # Полная пересборка
./scripts/deploy.sh app          # Только app (рекомендуется)
./scripts/deploy.sh restart      # Перезапуск без пересборки
./scripts/deploy.sh status       # Статус контейнеров
./scripts/deploy.sh logs [svc]   # Логи (по умолчанию: app)
```

### Что делает `deploy.sh app`:

1. Проверяет, не запущен ли cloudflared на Сервере 2
2. `npm run build`
3. `docker compose build app`
4. **Rolling restart**:
   - Масштабирование до 1 старого контейнера
   - Запуск 2 новых контейнеров
   - Ожидание healthy-статуса
   - Остановка последнего старого контейнера
   - Масштабирование обратно до 3 реплик
5. `nginx -s reload`
6. Очистка кэша Cloudflare
7. Healthcheck (до 3 минут ожидания)

### Почему НЕ использовать `docker compose up -d app`:

- Убивает все 3 реплики одновременно
- Вызывает 60+ секунд даунтайма
- Приводит к ошибкам 502/503

> **КРИТИЧЕСКИ ВАЖНО:** На проде **НИКОГДА** не запускать `docker compose up -d` без `-f docker-compose.prod.yml`! Без флага `-f` Docker мержит `docker-compose.yml` (dev) и `docker-compose.prod.yml` — app получает `ports: "3004:3004"` из dev-файла, nginx тоже маппит `"3004:80"` → конфликт портов → app не стартует вообще. Всегда указывать `-f docker-compose.prod.yml` явно или использовать `./scripts/deploy.sh`.

---

## Kubernetes

Манифесты в `infra/k8s/`.

### Быстрый старт

```bash
# Namespace
kubectl apply -f infra/k8s/namespace.yml

# Секреты
kubectl create secret generic sanbao-secrets \
  --from-env-file=.env -n sanbao

# ConfigMap
kubectl apply -f infra/k8s/configmap.yml

# Инфраструктура
kubectl apply -f infra/k8s/postgres.yml
kubectl apply -f infra/k8s/pgbouncer.yml
kubectl apply -f infra/k8s/redis.yml

# Миграции
kubectl apply -f infra/k8s/migration-job.yml
kubectl wait --for=condition=complete job/sanbao-migrate -n sanbao

# Приложение
kubectl apply -f infra/k8s/app-deployment.yml
kubectl apply -f infra/k8s/hpa.yml
kubectl apply -f infra/k8s/pdb.yml

# Ingress
kubectl apply -f infra/k8s/ingress.yml

# Network Policies
kubectl apply -f infra/k8s/network-policies.yml
```

### Компоненты

| Манифест | Описание |
|----------|----------|
| `namespace.yml` | Namespace `sanbao` |
| `secrets.yml` | Шаблон секретов (base64) |
| `configmap.yml` | NODE_ENV, LOG_FORMAT, LOG_LEVEL и др. |
| `app-deployment.yml` | 3 реплики, rolling update, probes |
| `postgres.yml` | StatefulSet, 50Gi PVC |
| `pgbouncer.yml` | Connection pooling (transaction mode) |
| `redis.yml` | Cache + очереди (512MB) |
| `ingress.yml` | Nginx Ingress + TLS + rate limiting |
| `hpa.yml` | Auto-scaling 3–20 pods (CPU/RAM 70%) |
| `pdb.yml` | Min 2 pods available |
| `migration-job.yml` | Prisma миграции + seed |
| `network-policies.yml` | Ingress/egress правила |
| `canary-rollout.yml` | Argo Rollouts (10→30→60→100%) |
| `backup-cronjob.yml` | Ежедневный бэкап в S3 (03:00 UTC) |

### Auto-scaling (HPA)

- Min: 3 реплики
- Max: 20 реплик
- CPU target: 70%
- Memory target: 70%
- Scale up: +4 pods / 60s или +50% / 60s
- Scale down: −2 pods / 120s (стабилизация 300s)

### Probes

| Probe | Path | Delay | Period | Threshold |
|-------|------|-------|--------|-----------|
| Liveness | `/api/health` | 30s | 15s | 3 failures |
| Readiness | `/api/ready` | 10s | 5s | 2 failures |
| Startup | `/api/health` | 5s | 5s | 12 failures (60s max) |

---

## CI/CD

### `.github/workflows/ci.yml`

Триггер: PR + push to main

1. **lint-and-type-check** — `npm lint` + `npm run build`
2. **test** — `npm test` (Vitest)
3. **docker-build** — Docker build test (только PR)

### `.github/workflows/deploy-server.yml`

Триггер: push to main / workflow_dispatch

1. **deploy-server1**:
   - `git fetch && git reset --hard origin/main`
   - `docker compose build --no-cache app`
   - `docker compose up -d app`
   - Healthcheck: `curl http://localhost:3004/api/health`

2. **deploy-server2** (после server1):
   - `git fetch && git reset --hard origin/main`
   - Пересборка warm standby + monitor bot
   - Healthcheck: `curl http://localhost:3004/api/ready`

3. **notify** — Telegram уведомление с результатами

**Требуемые GitHub Secrets:**
- `SSH_PRIVATE_KEY` — SSH-ключ для обоих серверов
- `TG_BOT_TOKEN` — токен Telegram-бота
- `TG_CHAT_ID` — ID чата для уведомлений

### `.github/workflows/deploy.yml`

Триггер: после успешного CI

1. **build-and-push** — Docker образ → GHCR (ghcr.io), теги: sha + latest
2. **deploy**:
   - kubectl + kubeconfig
   - Миграции (migration-job.yml)
   - `kubectl set image deployment/sanbao-app`
   - Ожидание rollout
   - Rollback при неудаче

---

## Nginx

Файл: `infra/nginx/nginx.conf`

### Rate Limiting

| Зона | Лимит | Применение |
|------|-------|------------|
| General | 30 req/s per IP | Все маршруты |
| Chat | 10 req/s per IP | `/api/chat` |
| Connections | 50 per IP | Глобально |

### Специальные маршруты

| Path | Настройки |
|------|-----------|
| `/api/health` | Без rate limit |
| `/api/metrics` | Только internal (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) |
| `/api/chat` | 10 req/s, таймаут 180s, proxy_buffering off (SSE) |
| `/_next/static` | Кэш 1 год |

### Security Headers

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `HSTS: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Proxy Headers

- `X-Forwarded-Proto: https` — **захардкожен** (не `$scheme`!), т.к. весь трафик через Cloudflare SSL. Нужен для корректной работы NextAuth OAuth (PKCE cookies).
- `X-Forwarded-For: $proxy_add_x_forwarded_for`
- `X-Real-IP: $remote_addr`

### Лимиты

- Client body: 20 МБ
- Client body timeout: 30s
- Gzip: on (text, css, json, js, xml)

---

## Мониторинг

### Health Endpoints

| Endpoint | Назначение | Rate Limit |
|----------|------------|------------|
| `GET /api/health` | Полная проверка (DB, Redis, AI, MCP) | Нет |
| `GET /api/ready` | Readiness (DB SELECT 1, Redis ping) | Нет |
| `GET /api/metrics` | Prometheus метрики | Bearer token |

### Prometheus + Grafana

```bash
# Запуск мониторинга
docker compose -f infra/docker-compose.monitoring.yml up -d

# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001 (admin / sanbao-grafana)
```

Файлы:
- `infra/monitoring/prometheus.yml` — конфиг + 7 алерт-правил
- `infra/monitoring/grafana.yml` — provisioning + 12-panel dashboard
- `infra/monitoring/alertmanager.yml` — маршрутизация алертов

### Docker Healthchecks

**App container:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://0.0.0.0:3004/api/ready || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 5
  start_period: 60s
```

**Nginx container:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1/api/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## Бэкапы

### Автоматические

- **CronJob** — ежедневно в 03:00 UTC (`infra/k8s/backup-cronjob.yml`)
- pg_dump + gzip-сжатие
- Загрузка в S3 (или MinIO)
- Ротация: 30 дней

### Ручные

```bash
# Через Telegram-бота
/backup

# Через скрипт
./scripts/pg-backup.sh
```

### Переменные для бэкапов

```env
S3_BUCKET=sanbao-backups
S3_ENDPOINT=https://s3.example.com  # опционально для MinIO
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Telegram-бот мониторинга

Расположение: Сервер 2, `~/faragj/deploy/bot/monitor_bot.py`

### Команды

| Команда | Описание |
|---------|----------|
| `/status` | Статус серверов (Sanbao + FragmentDB) |
| `/sync` | Синхронизация Сервер 1 → Сервер 2 |
| `/backup` | Запуск бэкапа БД |
| `/logs` | Синхронизация логов |
| `/docker` | docker ps на Сервере 2 |
| `/disk` | Использование диска |
| `/failover` | Активация Сервера 2 |
| `/failback` | Возврат на Сервер 1 |

### Авто-failover

- Проверка `/api/ready` на Сервере 1 каждые 30 секунд
- 3 последовательных сбоя → авто-failover (~90 секунд детекция)
- 3 последовательных успеха → авто-failback (~90 секунд восстановление)
- Cooldown 5 минут между операциями (защита от flapping)
- Автоматический запуск/остановка cloudflared на Сервере 2

### Уведомления

- `⚠️` Авто-failover выполнен
- `✅` Авто-failback выполнен
- `🔴` Авто-failover не удался

---

## Cloudflare Tunnel

### Конфигурация

- Tunnel Name: `mcp-1c`
- DNS: sanbao.ai, www.sanbao.ai, mcp.sanbao.ai, api.sanbao.ai → CNAME → tunnel

### Сервер 1 (systemd)

Файл: `/etc/cloudflared/config.yml`

```yaml
ingress:
  - hostname: sanbao.ai
    service: http://localhost:3004
  - hostname: www.sanbao.ai
    service: http://localhost:3004
  - hostname: mcp.sanbao.ai
    service: http://localhost:8120
  - service: http_status:404
```

```bash
# Управление
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
```

### Сервер 2 (Docker, profile: failover)

- Запускается только при авто-failover
- config-file mode с ingress rules
- Credentials: `/etc/cloudflared/credentials.json`
- Network: host mode

---

## Устранение неполадок

### Healthcheck fails (unhealthy)

**Причина:** Next.js слушает hostname контейнера, не localhost

**Решение:** Установить `HOSTNAME=0.0.0.0` в `.env`

### Сайт возвращает 503 (Cloudflare)

| Причина | Решение |
|---------|---------|
| cloudflared на Сервере 2 запущен, но Sanbao не стартовал | Остановить cloudflared на Сервере 2 |
| cloudflared на Сервере 1 не запущен | `sudo systemctl restart cloudflared` |
| Docker-контейнеры на Сервере 1 упали | `docker compose -f docker-compose.prod.yml up -d` (все сервисы!) |

### Деплой вызывает 502/503

**Причина:** `docker compose up -d app` пересоздаёт DB/Redis контейнеры (новые ID), app теряет зависимости и не стартует

**Решение:** деплой через `./scripts/deploy.sh app`. Если контейнеры уже упали — восстанавливать через `docker compose -f docker-compose.prod.yml up -d` (все сервисы, НЕ только app)

### PgBouncer Image Not Found

**Было:** `edoburu/pgbouncer:1.23.1-p2` (удалён из Docker Hub)

**Стало:** `edoburu/pgbouncer:latest`

### MCP-серверы недоступны (502 на /api/articles)

- AI Cortex (embedding-proxy, fragmentdb, orchestrator) работает как Docker-сервисы в `docker-compose.prod.yml`
- App-контейнеры обращаются по Docker-сетевому имени `orchestrator:8120`
- Если 502 — проверить что AI Cortex сервисы запущены: `docker compose -f docker-compose.prod.yml ps orchestrator fragmentdb`
- Пересборка: `./scripts/deploy.sh cortex`
- Подробная диагностика: `docs/DEVOPS.md` → Troubleshooting → MCP серверы недоступны

### Docker CLI отсутствует в боте

**Причина:** docker binary не установлен в образ бота

**Решение:** Пересобрать с Docker static binary в Dockerfile бота

### Google OAuth: `pkceCodeVerifier could not be parsed`

**Причина:** nginx передаёт `X-Forwarded-Proto: $scheme` (= `http`), NextAuth не может прочитать Secure PKCE cookies

**Решение:** в `infra/nginx/nginx.conf` все `X-Forwarded-Proto` должны быть `https`, затем `docker compose restart nginx`

### Cloudflared Server 2: `config.yml: is a directory`

**Причина:** Docker bind mount создаёт директорию вместо файла, если файл отсутствует на хосте

**Решение:** остановить контейнер → `sudo rm -rf /deploy/cloudflared/config.yml` → создать настоящий файл → НЕ запускать cloudflared пока не нужен failover

### App: `port is already allocated` (контейнеры не стартуют)

**Причина:** Docker Compose запущен без `-f docker-compose.prod.yml`, подхватил оба файла. В dev-файле app маппит `3004:3004`, в prod-файле nginx маппит `3004:80` — конфликт

**Диагностика:** `docker compose ls` — если в CONFIG FILES два файла, это причина

**Решение:**
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## MCP-серверы

| Сервер | URL (из Docker-контейнеров) | Назначение |
|--------|----------------------------|------------|
| Юрист | `http://orchestrator:8120/lawyer` | НПА (18 кодексов + 101K законов), поиск, статьи |
| Брокер | `http://orchestrator:8120/broker` | Таможня (13K ТН ВЭД), пошлины, декларации |
| Бухгалтер | `http://orchestrator:8120/accountant` | 1С Бухгалтерия КЗ (6.7K чанков) |
| 1С Консультант | `http://orchestrator:8120/consultant_1c` | Платформа 1С (29K чанков, BSP, EDT, ERP) |

AI Cortex Orchestrator (v0.8.0) работает как Docker-сервис `orchestrator` в `docker-compose.prod.yml` (порт 8120). Зависит от `fragmentdb` (векторная БД) и `embedding-proxy` (DeepInfra embeddings). App-контейнеры обращаются по Docker-сетевому имени.

**Env:**
```
LAWYER_MCP_URL=http://orchestrator:8120/lawyer
BROKER_MCP_URL=http://orchestrator:8120/broker
ACCOUNTINGDB_MCP_URL=http://orchestrator:8120/accountant
CONSULTANT_1C_MCP_URL=http://orchestrator:8120/consultant_1c
AI_CORTEX_AUTH_TOKEN=<bearer-token>
```

**Деплой AI Cortex:** `./scripts/deploy.sh cortex`

> Если MCP недоступен (502) — проверить сервисы: `docker compose -f docker-compose.prod.yml ps orchestrator fragmentdb`. Подробнее: `docs/DEVOPS.md` → Troubleshooting.

---

## Чеклист деплоя

- [ ] Все переменные окружения установлены в `.env`
- [ ] GitHub Secrets настроены (SSH_PRIVATE_KEY, TG_BOT_TOKEN, TG_CHAT_ID)
- [ ] Пароли БД сложные и уникальные
- [ ] Cloudflare Tunnel настроен и активен
- [ ] System Nginx на Сервере 1 настроен с SSL-сертификатом
- [ ] S3-бакет для бэкапов доступен
- [ ] Monitor bot настроен на Сервере 2
- [ ] Оба сервера доступны по SSH
- [ ] Docker daemon запущен на обоих серверах
- [ ] Код обновлён на обоих серверах
- [ ] `./scripts/deploy.sh app` протестирован
- [ ] Healthchecks проходят (`/api/ready`)
- [ ] Nginx reload успешен
- [ ] Кэш Cloudflare очищен

---

## Связанные документы

- [CLAUDE.md](CLAUDE.md) — архитектура проекта для Claude Code
- [README.md](README.md) — общее описание и быстрый старт
- [docs/DEVOPS.md](docs/DEVOPS.md) — полная DevOps документация
- [docs/STYLEGUIDE.md](docs/STYLEGUIDE.md) — дизайн-система
