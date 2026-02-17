# DevOps & Infrastructure Guide

## Серверы

| Роль | IP | SSH | Пользователь | Описание |
|------|-----|-----|--------------|----------|
| **Server 1 (Primary)** | `128.127.102.170` | порт `22222` | `metadmin` | Основной, обслуживает трафик |
| **Server 2 (Standby)** | `46.225.122.142` | порт `22` | `faragj` | Резервный, мониторинг, failover |

---

## Архитектура

```
                    ┌─────────────────────────────────┐
                    │         Cloudflare DNS           │
                    │  *.sanbao.ai → CF Tunnel (CNAME) │
                    │  Tunnel ID: 222e9fb5-...         │
                    └──────────┬──────────────────────┘
                               │ (Cloudflare Tunnel)
          ┌────────────────────┼──────────────────────┐
          ▼                                           ▼
   Server 1 (Primary)                        Server 2 (Standby)
   192.168.31.79 (NAT→128.127.102.170)      46.225.122.142
   ┌──────────────────────┐           ┌──────────────────────┐
   │ cloudflared (system)  │           │ monitor-bot (TG+auto)│
   │ Sys Nginx (:443→:3004)│           │ sanbao (:3004) warm  │
   │ Docker Nginx LB(:3004)│           │ fragmentdb (:8110)   │
   │  ├─ app-1 (:3004)    │           │ embedding-proxy(:8097)│
   │  ├─ app-2 (:3004)    │           │ orchestrator (:8120) │
   │  └─ app-3 (:3004)    │           │ db, pgbouncer, redis │
   │ PostgreSQL (:5432)    │           │                      │
   │ PgBouncer             │           │ [failover profile]:  │
   │ Redis                 │           │  cloudflared         │
   └──────────────────────┘           └──────────────────────┘
```

> **Server 1 за NAT** — внутренний IP `192.168.31.79`, внешний `128.127.102.170`. Прямое подключение на origin:443 НЕ работает (SSL SNI ошибка через NAT). Весь трафик идёт через Cloudflare Tunnel.

---

## Сервисы и порты

### Server 1 (`~/faragj/sanbao`)

| Сервис | Порт (внешний) | Порт (внутренний) | Описание |
|--------|---------------|-------------------|----------|
| cloudflared | - | - | CF Tunnel → `localhost:3004` (systemd сервис) |
| Sys Nginx | `443`, `80` | - | SSL termination (CF Origin Cert), proxy → `:3004` |
| Docker Nginx | `3004` | `80` | Load balancer, 3 реплики app |
| App (x3) | - | `3004` | Next.js standalone |
| PostgreSQL | `5436` | `5432` | БД |
| PgBouncer | - | `5432` | Connection pooling |
| Redis | - | `6379` | Кеш, очереди, rate-limit |

**Docker Compose:** `docker-compose.prod.yml`
**Cloudflared:** `/etc/cloudflared/config.yml` (systemd сервис, НЕ Docker)
**Системный Nginx:** `/etc/nginx/sites-enabled/sanbao.ai` (SSL + proxy)

### Server 2 (`~/faragj/deploy`)

| Сервис | Порт (внешний) | Порт (внутренний) | Описание |
|--------|---------------|-------------------|----------|
| FragmentDB | `8110` | `8080` | Векторная БД (Rust) |
| Embedding Proxy | `8097` | `8097` | DeepInfra embeddings |
| Orchestrator | `8120` | `8120` | MCP сервер (lawyer/broker) |
| Monitor Bot | - | - | Telegram бот мониторинга |
| Cloudflared | - | - | CF tunnel (failover profile) |
| PostgreSQL | `5436` | `5432` | Standby БД Sanbao |
| PgBouncer | - | `5432` | Connection pooling |
| Redis | - | `6379` | Standby Redis |

**Docker Compose:** `docker-compose.failover.yml`

---

## Telegram Bot (мониторинг)

**Расположение:** `Server 2 → ~/faragj/deploy/bot/monitor_bot.py`

**Команды:**
| Команда | Описание |
|---------|----------|
| `/status` | Статус обоих серверов (Sanbao + FragmentDB) |
| `/sync` | Синхронизация данных Server 1 → Server 2 |
| `/backup` | Запустить бекап БД |
| `/logs` | Логи синхронизации |
| `/docker` | Docker ps на Server 2 |
| `/disk` | Место на диске |
| `/failover` | Переключить трафик на Server 2 |
| `/failback` | Вернуть трафик на Server 1 |

**Конфиг (в `~/faragj/deploy/.env`):**
```env
TG_BOT_TOKEN=8138941558:AAFzd3wn8_8ngR9HeFckZuPahZUwIA1kKJo
TG_CHAT_ID=713121714
BOT_PASSWORD=Ckdshfh231161!
```

### Автоматический Failover

Бот автоматически переключает трафик при падении Server 1 и возвращает обратно при восстановлении.

**Как работает:**

1. Бот проверяет `Server 1 → /api/ready` каждые **30 секунд** через SSH
2. Если Server 1 недоступен **3 проверки подряд (90с)** → автоматически запускает `cloudflared` на Server 2
3. Cloudflare видит второй коннектор → трафик идёт на Server 2 (sanbao уже работает как warm standby)
4. Если Server 1 восстановился **3 проверки подряд (90с)** + прошёл **cooldown 5 мин** → останавливает `cloudflared` на Server 2
5. Трафик возвращается на Server 1 (единственный активный коннектор)

**Параметры:**

| Параметр | Значение | Описание |
|----------|----------|----------|
| `MONITOR_INTERVAL` | 30с | Интервал проверок |
| `FAILOVER_THRESHOLD` | 3 | Кол-во провалов до переключения |
| `RECOVERY_THRESHOLD` | 3 | Кол-во успехов до возврата |
| `COOLDOWN_SECONDS` | 300с (5мин) | Минимум между переключениями |

**Защита от flapping:** после каждого failover/failback включается cooldown 5 минут. Во время cooldown автоматические переключения заблокированы.

**Telegram уведомления:**
- `⚠️ Auto-failover выполнен` — при переключении на Server 2
- `✅ Auto-failback выполнен` — при возврате на Server 1
- `🔴 Auto-failover не удался!` — если cloudflared не запустился

**Warm standby:** Sanbao на Server 2 запущен постоянно (обновляется при каждом CI/CD деплое). При auto-failback останавливается только cloudflared, sanbao продолжает работать.

**Состояние:** файл `/tmp/failover-state` — восстанавливается при перезагрузке бота.

**Ручные команды `/failover` и `/failback` продолжают работать** и корректно синхронизируют состояние с автоматикой.

---

## MCP серверы

| Сервер | URL (из Server 1) | Агенты | Инструменты |
|--------|-------------------|--------|-------------|
| **Юрист** | `http://172.28.0.1:8120/lawyer` | НПА, Бухгалтер, Брокер | search, lookup, list_domains, get_article, graph_traverse |
| **Брокер** | `http://172.28.0.1:8120/broker` | Таможенный брокер | search, sql_query, classify_goods, calculate_duties, get_required_docs, list_domains, generate_declaration |
| **AccountingDB** | `https://mcp.sanbao.ai/accountant` | Бухгалтер | (manual discovery) |

`172.28.0.1` — Docker bridge gateway, MCP Orchestrator на Server 2 слушает `:8120`.

---

## CI/CD (GitHub Actions)

### `.github/workflows/deploy-server.yml`

**Триггер:** push в `main` или ручной запуск

**Этапы:**
1. **Server 1** — `git pull` → `docker compose build --no-cache app` → `docker compose up -d app` → healthcheck
2. **Server 2** — `git pull` → `build sanbao` → `up -d sanbao` (warm standby) → healthcheck → `rebuild monitor-bot`
3. **Telegram уведомление** — результат деплоя

**Секреты GitHub:**
| Секрет | Описание |
|--------|----------|
| `SSH_PRIVATE_KEY` | SSH ключ для обоих серверов |
| `TG_BOT_TOKEN` | Токен Telegram бота |
| `TG_CHAT_ID` | ID чата для уведомлений |

### `.github/workflows/ci.yml`

**Триггер:** PR + push в `main`

**Этапы:** lint → build → test → docker build (только PR)

---

## Cloudflare

**Tunnel ID:** `222e9fb5-634f-4064-a1e9-8af13f47e4f1`
**Tunnel Name:** `mcp-1c`

### Архитектура маршрутизации

DNS все домены (`sanbao.ai`, `www.sanbao.ai`, `mcp.sanbao.ai`, `api.sanbao.ai`) → CNAME → `222e9fb5-...cfargotunnel.com` (proxied). Трафик идёт **через Cloudflare Tunnel**, НЕ напрямую на origin:443.

**Server 1** — системный сервис `cloudflared` (`/etc/cloudflared/config.yml`):
- Маршруты: `sanbao.ai` → `http://localhost:3004`, `leema.kz` → `:3100`, `mcp.sanbao.ai` → `:8120`, и др.
- Обновить конфиг: `sudo nano /etc/cloudflared/config.yml && sudo systemctl restart cloudflared`

**Server 2** — Docker контейнер `deploy-cloudflared-1` (profile `failover`):
- Запускается ТОЛЬКО при failover: `docker compose --profile failover up -d`
- **ВАЖНО:** НЕ запускать cloudflared на Server 2 если sanbao там не запущен! Иначе Cloudflare будет балансировать между серверами и часть запросов уйдёт в пустоту → 503.

### CF API доступ

```env
CF_API_TOKEN=ympF_5OJdcmeFAZCrb3As2ArTQhg_5lYQ4nCCxDS
CF_ZONE_ID=73025f5522d28a0111fb6afaf39e8c31  # sanbao.ai
```

Проверить DNS записи:
```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" | python3 -m json.tool
```

---

## Запуск / Рестарт

### Server 1 — полный рестарт

```bash
ssh metadmin@128.127.102.170 -p 22222
cd ~/faragj/sanbao
docker compose -f docker-compose.prod.yml up --build -d
```

### Server 1 — рестарт только приложения

```bash
docker compose -f docker-compose.prod.yml up --build -d app
docker compose -f docker-compose.prod.yml restart nginx
```

### Server 2 — полный рестарт

```bash
ssh faragj@46.225.122.142
cd ~/faragj/deploy
docker compose -f docker-compose.failover.yml up --build -d
```

### Server 2 — запуск failover (включить tunnel, sanbao уже работает)

```bash
docker compose -f docker-compose.failover.yml --profile failover up -d cloudflared
```

### Server 2 — остановить failover (вернуть трафик на Server 1)

```bash
docker compose -f docker-compose.failover.yml stop cloudflared
```

### Server 2 — только мониторинг (без Sanbao)

```bash
docker compose -f docker-compose.failover.yml up -d fragmentdb embedding-proxy orchestrator monitor-bot db pgbouncer redis
```

---

## Бекапы

**Автоматические:** CronJob в k8s (`k8s/backup-cronjob.yml`) — daily 03:00 UTC, pg_dump → S3, 30 дней retention.

**Ручные (через Telegram бот):** `/backup`

**Скрипт:** `scripts/pg-backup.sh`

---

## Мониторинг

### Endpoints

| Endpoint | Описание | Rate-limit |
|----------|----------|-----------|
| `GET /api/ready` | Readiness probe (DB + Redis) | Нет |
| `GET /api/health` | Полная диагностика | Нет |
| `GET /api/metrics` | Prometheus метрики | Bearer token |

### Docker Compose Monitoring (опционально)

```bash
docker compose -f docker-compose.monitoring.yml up -d
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/sanbao-grafana)
```

---

## Переменные окружения

### Обязательные (production)

| Переменная | Пример | Где |
|-----------|--------|-----|
| `DATABASE_URL` | `postgresql://user:pass@pgbouncer:5432/sanbao` | `.env` |
| `AUTH_SECRET` | base64 строка | `.env` |
| `AUTH_URL` | `https://www.sanbao.ai` | `.env` |
| `MOONSHOT_API_KEY` | `sk-...` | `.env` |
| `ADMIN_PASSWORD` | сложный пароль | `.env` |
| `ADMIN_EMAIL` | `admin@sanbao.local` | `.env` |

### Docker-specific (задаются в docker-compose)

| Переменная | Описание |
|-----------|----------|
| `HOSTNAME` | `0.0.0.0` — Next.js слушает на всех интерфейсах |
| `DIRECT_DATABASE_URL` | Прямое подключение к БД (минуя PgBouncer, для миграций) |
| `REDIS_URL` | `redis://redis:6379` |
| `NODE_ENV` | `production` |
| `SHUTDOWN_DRAIN_MS` | `15000` (graceful shutdown) |

### AI провайдеры

| Переменная | Провайдер | Модель |
|-----------|-----------|--------|
| `MOONSHOT_API_KEY` | Kimi K2.5 (текст) | `kimi-k2.5` |
| `DEEPINFRA_API_KEY` | DeepInfra (картинки) | `FLUX-1-schnell` |
| `OPENAI_API_KEY` | OpenAI (резерв) | - |
| `ANTHROPIC_API_KEY` | Anthropic (резерв) | - |

### Опциональные

| Переменная | Описание |
|-----------|----------|
| `REDIS_URL` | Redis (graceful degradation без него) |
| `STRIPE_SECRET_KEY` | Stripe платежи |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks |
| `SENTRY_DSN` | Sentry мониторинг ошибок |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | S3/MinIO хранилище |
| `CDN_URL` | CDN для статики |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email отправка |
| `ADMIN_IP_WHITELIST` | CSV IP адресов для админки |
| `METRICS_TOKEN` | Bearer токен для /api/metrics |
| `CRON_SECRET` | Секрет для cron endpoint'ов |

---

## Файловая структура инфраструктуры

```
sanbao/
├── Dockerfile                      # Multi-stage build (Node 20 Alpine)
├── docker-entrypoint.sh            # Миграции + seed + запуск
├── docker-compose.yml              # Dev (db + pgbouncer + redis + app)
├── docker-compose.prod.yml         # Prod (+ nginx LB, 3 реплики)
├── docker-compose.monitoring.yml   # Prometheus + Grafana
├── nginx/
│   └── nginx.conf                  # LB, rate-limit, SSE, security headers
├── .github/workflows/
│   ├── ci.yml                      # Lint + test + build
│   ├── deploy.yml                  # K8s deploy (GHCR + rollout)
│   └── deploy-server.yml           # SSH deploy Server 1 + Server 2 + TG
├── scripts/
│   ├── pg-backup.sh                # PostgreSQL → S3 бекап
│   ├── start-mcp-servers.sh        # Запуск 5 MCP серверов (dev)
│   └── upload-static.sh            # Static → S3/CDN
├── k8s/
│   ├── namespace.yml
│   ├── secrets.yml
│   ├── configmap.yml
│   ├── app-deployment.yml          # 3 реплики, HPA 3→20
│   ├── postgres.yml                # StatefulSet, 50Gi PVC
│   ├── redis.yml
│   ├── pgbouncer.yml
│   ├── ingress.yml                 # Nginx Ingress + Let's Encrypt
│   ├── hpa.yml                     # CPU/Memory autoscaling
│   ├── pdb.yml                     # minAvailable: 2
│   ├── canary-rollout.yml          # Argo Rollouts 10→30→60→100%
│   ├── network-policies.yml
│   ├── migration-job.yml
│   ├── backup-cronjob.yml          # Daily 03:00 UTC
│   └── monitoring/
│       ├── prometheus.yml          # 7 alert rules
│       ├── grafana.yml             # 12 panels dashboard
│       └── alertmanager.yml
└── .env                            # Environment variables
```

### Server 2 (`~/faragj/deploy/`)

```
deploy/
├── docker-compose.failover.yml     # FragmentDB + Sanbao standby + bot
├── .env                            # TG, CF, primary/standby IPs
├── .env.sanbao                     # Sanbao env для standby
├── bot/
│   ├── Dockerfile
│   ├── monitor_bot.py              # Telegram бот мониторинга
│   └── requirements.txt
├── sync.sh                         # Синхронизация Server 1 → 2
├── backup.sh                       # Бекап через бот
└── failback.sh                     # Возврат на Server 1
```

---

## Troubleshooting

### Healthcheck не проходит (unhealthy)

1. `localhost` не резолвится в Alpine → использовать `0.0.0.0` или `127.0.0.1`
2. Next.js standalone слушает на hostname контейнера → задать `HOSTNAME=0.0.0.0`
3. Rate-limit на `/api/ready` → убран (внутренний endpoint)

### PgBouncer образ не найден

`edoburu/pgbouncer:1.23.1-p2` удалён → использовать `edoburu/pgbouncer:latest`

### MCP серверы недоступны

MCP Orchestrator на Server 2 (`46.225.122.142:8120`). Server 1 обращается через Docker bridge `172.28.0.1:8120`. Проверить:
```bash
ssh faragj@46.225.122.142 "docker logs deploy-orchestrator-1 --tail 20"
```

### Сайт возвращает 503 (Cloudflare)

**Причина 1:** Cloudflared на Server 2 запущен, но sanbao там не работает. Cloudflare балансирует запросы между коннекторами обоих серверов → часть уходит в пустоту.

```bash
# Проверить коннекторы тоннеля
cloudflared tunnel info 222e9fb5-634f-4064-a1e9-8af13f47e4f1

# Если на Server 2 cloudflared запущен без sanbao — остановить:
ssh faragj@46.225.122.142 "cd ~/faragj/deploy && docker compose -f docker-compose.failover.yml stop cloudflared"
```

**Причина 2:** cloudflared на Server 1 не запущен.

```bash
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
# Логи: sudo journalctl -u cloudflared -f
```

**Причина 3:** Docker контейнеры Sanbao упали → тоннель проксирует на неработающий localhost:3004.

```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost:3004/api/ready
```

**Проверка тоннеля (метрики):**
```bash
curl -s http://localhost:20241/metrics | grep -E 'total_requests|request_errors|ha_connections'
```

### SSL "unrecognized name" на origin:443

Server 1 за NAT (192.168.31.79 → 128.127.102.170). Прямое подключение на 128.127.102.170:443 возвращает TLS alert "unrecognized name". Это **не баг** — трафик идёт через Cloudflare Tunnel, порт 443 используется только для fallback (системный nginx + Cloudflare Origin Certificate).

### Telegram бот не отвечает

```bash
ssh faragj@46.225.122.142 "docker logs deploy-monitor-bot-1 --tail 20"
```
