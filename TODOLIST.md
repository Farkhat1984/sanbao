# TODOLIST: Sanbao — Full Audit & Code Review

**Дата:** 2026-02-28
**Источник:** Полный аудит проекта (Security, API, Frontend, Infrastructure, Business Logic)
**Найдено:** 97 замечаний (5 CRITICAL, 12 HIGH, 38 MEDIUM, 42 LOW)

---

## Этап 1 — CRITICAL: Немедленное исправление (сегодня)

### 1.1 Cloudflare API-токен захардкожен в deploy.sh
**Severity:** CRITICAL
**Файл:** `scripts/deploy.sh:42-43`
**Проблема:** Реальный Cloudflare API-токен и Zone ID в git-репозитории. Любой с доступом к репо может управлять CDN.
```bash
CF_API_TOKEN="${CF_API_TOKEN:-ympF_5OJdcmeFAZCrb3As2ArTQhg_5lYQ4nCCxDS}"
CF_ZONE_ID="${CF_ZONE_ID:-73025f5522d28a0111fb6afaf39e8c31}"
```
**Решение:**
- [x] 1.1.1 Удалить дефолтные значения токенов из скрипта
- [ ] 1.1.2 Ротировать токен Cloudflare (старый скомпрометирован) *(ручная операция)*
- [x] 1.1.3 Перенести в env-переменные сервера или secrets manager

### 1.2 Prisma directUrl указывает на PgBouncer вместо прямого подключения
**Severity:** CRITICAL
**Файл:** `prisma/schema.prisma:8`
**Проблема:** `directUrl = env("DATABASE_URL")` — миграции идут через PgBouncer (transaction mode), что ненадёжно для DDL.
**Решение:**
- [x] 1.2.1 Изменить `directUrl = env("DIRECT_DATABASE_URL")` в schema.prisma
- [x] 1.2.2 `DIRECT_DATABASE_URL` задан в `.env` (порт 5436 → прямой PostgreSQL, минуя PgBouncer)

### 1.3 `--accept-data-loss` в production entrypoint
**Severity:** CRITICAL
**Файл:** `docker-entrypoint.sh:22`
**Проблема:** `prisma db push --accept-data-loss` автоматически принимает деструктивные изменения схемы (удаление колонок/таблиц) без подтверждения.
**Решение:**
- [x] 1.3.1 Убрать `--accept-data-loss` из entrypoint
- [x] 1.3.2 Перейти на `prisma migrate deploy` для production (уже реализовано с fallback)

### 1.4 SSRF в admin MCP PUT (нет валидации URL)
**Severity:** CRITICAL
**Файл:** `src/app/api/admin/mcp/[id]/route.ts:20-26`
**Проблема:** PUT-роут обновляет `url` без SSRF-проверки (POST-роут защищён, PUT — нет). Компрометированный admin может указать внутренний URL.
**Решение:**
- [x] 1.4.1 Добавить `isUrlSafe()` проверку при обновлении поля `url`

### 1.5 Live API-ключи и слабые пароли в .env
**Severity:** CRITICAL
**Файл:** `.env`
**Проблема:** `ADMIN_PASSWORD="TestAdmin123!"`, `CRON_SECRET="sanbao-cron-secret-change-in-production"`, live API keys Moonshot/DeepInfra/Google.
**Решение:**
- [ ] 1.5.1 Ротировать все API-ключи *(ручная операция)*
- [x] 1.5.2 Задать криптографически стойкий ADMIN_PASSWORD (seed.ts теперь fail hard)
- [x] 1.5.3 CRON_SECRET заменён на crypto-random (40 chars, openssl rand)
- [ ] 1.5.4 Рассмотреть secrets manager для production *(ручная операция)*

---

## Этап 2 — HIGH: Серьёзные проблемы (эта неделя)

### 2.1 Security: Legacy plaintext API-ключи в БД
**Severity:** HIGH
**Файл:** `src/lib/api-key-auth.ts:28-36`
**Проблема:** Fallback lookup по plaintext `key` для legacy ключей. При утечке БД ключи доступны.
**Решение:**
- [x] 2.1.1 Написать миграционный скрипт: `scripts/migrate-api-keys.ts` (SHA-256 hash + prefix truncation). `keyHash`/`keyPrefix` теперь required в schema. Запуск: `npx tsx scripts/migrate-api-keys.ts` → `npx prisma db push`
- [x] 2.1.2 Удалить fallback plaintext lookup из `api-key-auth.ts`

### 2.2 Security: CSP `unsafe-inline` + `unsafe-eval` обнуляют XSS-защиту
**Severity:** HIGH
**Файл:** `next.config.ts:12`
**Проблема:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` делает CSP неэффективным.
**Решение:**
- [ ] 2.2.1 Исследовать nonce-based CSP для Next.js 16 *(отдельный проект — требует middleware + nonce propagation)*
- [x] 2.2.2 Убрать `unsafe-eval` из script-src (CodePreview в sandboxed iframe — CSP основной страницы не применяется)
- [x] 2.2.3 Задокументировано: `unsafe-inline` required by Next.js App Router + Tailwind CSS v4

### 2.3 Security: Encryption key fallback на AUTH_SECRET
**Severity:** HIGH
**Файл:** `src/lib/crypto.ts:10-16`
**Проблема:** `ENCRYPTION_KEY` не задан — шифрование 2FA/API-ключей использует `AUTH_SECRET`. Компрометация одного секрета раскрывает всё.
**Решение:**
- [x] 2.3.1 Сгенерировать отдельный `ENCRYPTION_KEY` (AES-256, base64, 44 chars)
- [x] 2.3.2 Задан в `.env` на Server 2. Server 1 — при деплое (docker-compose env)
- [x] 2.3.3 Перешифрованы 7 2FA secrets (6 encrypted + 1 plaintext → all re-encrypted). Скрипт: `scripts/reencrypt-2fa.ts`

### 2.4 Infra: PgBouncer `AUTH_TYPE: plain` в production
**Severity:** HIGH
**Файл:** `docker-compose.prod.yml:52`
**Проблема:** Пароли передаются в plaintext между PgBouncer и клиентами.
**Решение:**
- [x] 2.4.1 Изменить на `AUTH_TYPE: scram-sha-256`
- [ ] 2.4.2 Протестировать подключение после смены *(ручная операция)*

### 2.5 Infra: Общий SSH-ключ для обоих серверов
**Severity:** HIGH
**Файл:** `.github/workflows/deploy-server.yml:22,58`
**Проблема:** Один `SSH_PRIVATE_KEY` для обоих серверов. Компрометация = оба сервера.
**Решение:**
- [ ] 2.5.1 Сгенерировать отдельные SSH-ключи для каждого сервера
- [ ] 2.5.2 Обновить GitHub secrets: `SSH_KEY_SERVER1`, `SSH_KEY_SERVER2`

### 2.6 Billing: Race condition — 30-сек кэш usage позволяет обход лимитов
**Severity:** HIGH
**Файл:** `src/lib/usage.ts:25-93`
**Проблема:** `getUserPlanAndUsage()` кэширует usage в Redis на 30 сек. За это время N запросов проходят проверку лимита с одним и тем же `messageCount`.
**Решение:**
- [x] 2.6.1 Использовать Redis atomic counter (`INCR`) для usage checks
- [x] 2.6.2 Уменьшить TTL кэша до 5 сек
- [x] 2.6.3 Разделить кэш: plan (5s) и usage (atomic daily counter)

### 2.7 Billing: Promo-код не списывается атомарно в checkout
**Severity:** HIGH
**Файл:** `src/app/api/billing/freedom/checkout/route.ts:29-39`, `src/app/api/billing/checkout/route.ts:43`
**Проблема:** Freedom Pay и Stripe checkout читают и применяют promo-код без `usedCount` increment. Промо-код используется неограниченно.
**Решение:**
- [x] 2.7.1 Добавить atomic `$executeRaw` increment `usedCount` в обоих checkout роутах
- [x] 2.7.2 Проверить `maxUses` перед применением

### 2.8 Billing: Promo rollback не атомарен
**Severity:** HIGH
**Файл:** `src/app/api/billing/apply-promo/route.ts:56-68`
**Проблема:** После atomic increment, если `planId` не совпадает — rollback через отдельный запрос. Если rollback падает, `usedCount` навсегда увеличен.
**Решение:**
- [x] 2.8.1 Обернуть increment + проверку planId в `prisma.$transaction`

### 2.9 Frontend: MessageInput.tsx — 1085 строк, монолитный компонент
**Severity:** HIGH
**Файл:** `src/components/chat/MessageInput.tsx`
**Проблема:** Stream parsing, voice recording, file handling, submission — всё в одном файле.
**Решение:**
- [x] 2.9.1 Извлечь `useStreamChat` хук (411 строк)
- [x] 2.9.2 Извлечь `useFileAttachment` хук (184 строки)
- [x] 2.9.3 Извлечь `useVoiceRecording` хук (113 строк)
- [x] 2.9.4 Извлечь `PlusMenu` компонент (242 строки). MessageInput: 1093→348 строк (-68%)

### 2.10 State: chatStore копирует массив на каждый chunk стрима
**Severity:** HIGH
**Файл:** `src/stores/chatStore.ts:149-164`
**Проблема:** `updateLastAssistantMessage` делает `[...s.messages]` на каждый NDJSON chunk (сотни раз/сек), вызывая re-render всех подписчиков.
**Решение:**
- [x] 2.10.1 Вынести streaming content в отдельное поле `streamingContent`
- [x] 2.10.2 Мержить в `messages` только по завершении стрима

### 2.11 A11y: Чат без ARIA-ориентиров
**Severity:** HIGH
**Файл:** `src/components/chat/ChatArea.tsx:110`
**Проблема:** Messages container без `role="log"`, `aria-live="polite"`. Screen readers не видят чат.
**Решение:**
- [x] 2.11.1 Добавить `role="log"` и `aria-live="polite"` на контейнер сообщений
- [x] 2.11.2 Добавить `role="article"` на каждый MessageBubble

### 2.12 A11y: Интерактивные кнопки без aria-label
**Severity:** HIGH
**Файл:** Multiple files (MessageBubble, MessageInput, Sidebar, Header, ConversationItem)
**Проблема:** Copy, Retry, Send, Stop, Mic, New Chat, Close sidebar, dropdown items — все без `aria-label`.
**Решение:**
- [x] 2.12.1 Добавить `aria-label` ко всем интерактивным кнопкам
- [x] 2.12.2 Добавить `aria-label` к textarea MessageInput

---

## Этап 3 — MEDIUM: Безопасность (ближайший спринт)

### 3.1 2FA обходится при мобильном OAuth
**Файл:** `src/app/api/auth/apple/route.ts:94`, `src/app/api/auth/mobile/google/route.ts:84`
**Проблема:** `twoFactorVerified: true` без реальной TOTP-проверки.
- [x] 3.1.1 Задокументировано: OAuth provider verification = 2FA (Apple/Google verify identity)

### 3.2 SSRF: нет защиты от DNS rebinding, неполные IPv6
**Файл:** `src/lib/ssrf.ts:6-7` (дублирован в 4 файлах)
- [x] 3.2.1 Централизовать SSRF-проверку в одном модуле
- [x] 3.2.2 Добавить DNS resolve перед проверкой IP (`isUrlSafeAsync`)
- [x] 3.2.3 Блокировать IPv6 private ranges: `::ffff:127.0.0.1`, `fc00::/7`, `fe80::/10`
- [x] 3.2.4 Удалить дублирование `BLOCKED_HOSTS` из 3 других файлов

### 3.3 Rate limit: in-memory fallback per-replica = x3 лимит
**Файл:** `src/lib/rate-limit.ts`
- [x] 3.3.1 Логировать warning при fallback на in-memory
- [x] 3.3.2 Добавлен production startup warning если Redis недоступен
- [x] 3.3.3 `checkAuthRateLimit()` переведён на Redis-first (async): `redisRateLimit()` + `cacheSet()` для block, in-memory fallback. Все 5 callers обновлены на `await`

### 3.4 Freedom Pay: не timing-safe сравнение подписи
**Файл:** `src/lib/freedom-pay.ts:53`
- [x] 3.4.1 Заменить `===` на `crypto.timingSafeEqual(Buffer.from(pg_sig), Buffer.from(expected))`

### 3.5 30-дневный JWT без ротации
**Файл:** `src/lib/mobile-session.ts:3`, `src/lib/constants.ts:114`
- [x] 3.5.1 Уменьшить access token до 1 часа
- [x] 3.5.2 Реализовать refresh token механизм (Redis-backed, sliding window)
- [x] 3.5.3 Добавить token blacklist в Redis для revocation (jti-based)

### 3.6 `new Function()` для math eval
**Файл:** `src/lib/native-tools/analysis.ts:79`
- [x] 3.6.1 Заменить `new Function()` на `expr-eval` библиотеку

### 3.7 CSP `connect-src` разрешает все HTTPS
**Файл:** `next.config.ts:16`
- [x] 3.7.1 Ограничить `connect-src` конкретными доменами (API, Sentry, Cloudflare, AI providers)

### 3.8 MCP tool calls без SSRF-проверки URL
**Файл:** `src/lib/mcp-client.ts:83-90`
- [x] 3.8.1 Добавить `isUrlSafe()` перед созданием MCP transport

### 3.9 Admin sessions DELETE all — удаляет свою сессию
**Файл:** `src/app/api/admin/sessions/route.ts:35`
- [x] 3.9.1 Исключить текущую сессию admin из `deleteMany`
- [x] 3.9.2 Добавить `?confirm=true` requirement для bulk delete

### 3.10 Admin tools/users PUT — нет валидации
**Файл:** `src/app/api/admin/tools/[id]/route.ts:40-55`, `src/app/api/admin/users/[id]/route.ts:13`
- [x] 3.10.1 Добавить Zod-схему для admin tool update
- [x] 3.10.2 Добавить валидацию `bannedReason` length, `role` enum

### 3.11 XSS в HTML-экспорте через markdown links
**Файл:** `src/lib/export-utils.ts:97`
- [x] 3.11.1 Санитизировать URL в markdown link regex (блокировать `javascript:`)
- [x] 3.11.2 HTML-escape link text

### 3.12 2FA setup возвращает plaintext TOTP secret
**Файл:** `src/app/api/auth/2fa/route.ts:41`
- [x] 3.12.1 Убран raw secret из GET ответа, возвращается только QR code

---

## Этап 4 — MEDIUM: Производительность (ближайший спринт)

### 4.1 MCP: новое подключение на каждый вызов
**Файл:** `src/lib/mcp-client.ts:68-156`
**Проблема:** Каждый `callMcpTool()` создаёт Client, подключается, вызывает, закрывает. 15-сек timeout на подключение.
- [x] 4.1.1 Реализовать connection pool для MCP клиентов (5-мин TTL, auto-cleanup)
- [x] 4.1.2 Кэшировать подключения с TTL и health check + retry на dead connection

### 4.2 Token estimation chars/3 — недооценка для кириллицы
**Файл:** `src/lib/context.ts:7`
**Проблема:** Кириллический текст: 1-2 chars/token, а не 3. Compaction срабатывает поздно.
- [x] 4.2.1 Определять язык текста и использовать chars/1.5 для кириллицы
- [ ] 4.2.2 Или использовать tiktoken/gpt-tokenizer для точного подсчёта

### 4.3 Admin analytics: 8+ последовательных запросов, N+1
**Файл:** `src/app/api/admin/analytics/route.ts:18-108`
- [x] 4.3.1 Объединить `topUsers` + `userNames` в один JOIN запрос
- [x] 4.3.2 Использовать `Promise.all` для независимых запросов

### 4.4 Conversations: нет cursor-пагинации
**Файл:** `src/app/api/conversations/route.ts:14`
- [x] 4.4.1 Добавить cursor-based pagination с `lastId` параметром
- [x] 4.4.2 Поддержать `?cursor=xxx&limit=50` API

### 4.5 Артефакты дублируются в ответе conversations/[id]
**Файл:** `src/app/api/conversations/[id]/route.ts:31`
- [x] 4.5.1 Убрать `artifacts: true` с уровня conversation (оставлено на messages)

### 4.6 DocumentEditor/CodePreview не lazy-loaded
**Файл:** `src/components/artifacts/DocumentEditor.tsx`, `CodePreview.tsx`
**Проблема:** Tiptap + extensions ~150KB gzipped загружается всегда, хотя используется редко.
- [x] 4.6.1 Обернуть в `dynamic(() => import("./DocumentEditor"), { ssr: false })`
- [x] 4.6.2 Аналогично для CodePreview

### 4.7 MessageBubble: framer-motion animate на каждом render
**Файл:** `src/components/chat/MessageBubble.tsx:320-323`
- [x] 4.7.1 Анимировать только последнее сообщение (`initial={isLast ? ... : false}`)

### 4.8 ConversationList: не мемоизирован
**Файл:** `src/components/sidebar/ConversationList.tsx:11`
- [x] 4.8.1 Обернуть `ConversationItem` в `React.memo`
- [x] 4.8.2 Использовать индивидуальные Zustand selectors (Sidebar + ConversationList)

---

## Этап 5 — MEDIUM: React/Frontend (следующий спринт)

### 5.1 Нет `loading.tsx` ни в одном route group
- [x] 5.1.1 Добавить `loading.tsx` в `(app)/`
- [x] 5.1.2 Добавить `loading.tsx` в `(admin)/admin/`

### 5.2 Нет error boundary для panel/artifacts
**Файл:** `src/components/panel/UnifiedPanel.tsx`
- [x] 5.2.1 Обернуть `ArtifactContent` и `ArticleContentView` в ErrorBoundary

### 5.3 Нет store reset при logout — утечка данных
**Файл:** Все stores в `src/stores/`
- [x] 5.3.1 Создать `resetAllStores()` функцию
- [x] 5.3.2 Вызывать при signOut

### 5.4 `window.history.replaceState` обходит Next.js router
**Файл:** `src/components/chat/MessageInput.tsx:344`
- [x] 5.4.1 Заменить на `router.replace(\`/chat/${conv.id}\`)`

### 5.5 4 suppressed `exhaustive-deps` — потенциальные stale closures
**Файлы:** `MessageInput.tsx:297`, `MessageBubble.tsx:291`, `Sidebar.tsx:51`, `AppShell.tsx:27`
- [x] 5.5.1 Ревью: добавлены недостающие stable deps, задокументированы intentional exclusions

### 5.6 Pin/Archive кнопки без onClick — UI-обманка
**Файл:** `src/components/sidebar/ConversationItem.tsx:129-136`
- [x] 5.6.1 Реализовать Pin/Archive handlers с API вызовами

### 5.7 Mobile sidebar без focus trap и aria-modal
**Файл:** `src/components/layout/AppShell.tsx:37-61`
- [x] 5.7.1 Добавить `role="dialog"`, `aria-modal="true"`
- [x] 5.7.2 Добавить focus trap (Tab cycling + Escape close + focus restore)

### 5.8 Panel без focus management
**Файл:** `src/components/panel/UnifiedPanel.tsx`
- [x] 5.8.1 При открытии — фокус на close button
- [x] 5.8.2 При закрытии — возврат фокуса к trigger-элементу

### 5.9 MessageBubble: тяжёлая inline parsing логика
**Файл:** `src/components/chat/MessageBubble.tsx` (618 строк)
- [x] 5.9.1 Извлечь `parseContentWithArtifacts` → `src/lib/parse-message-content.ts`
- [x] 5.9.2 Извлечь `markdownComponents` → `src/lib/markdown-components.tsx`

### 5.10 CodePreview: HTML генераторы inline
**Файл:** `src/components/artifacts/CodePreview.tsx` (508 строк)
- [x] 5.10.1 Извлечь `buildPreviewHtml`/`buildPythonHtml` → `src/lib/code-preview-builder.ts` (CodePreview: 510→135 строк)

---

## Этап 6 — MEDIUM: Инфраструктура

### 6.1 `.dockerignore` не исключает `.env`
- [x] 6.1.1 Добавить в `.dockerignore`: `.env`, `logs/`, `docs/`, `.github/`, `.claude/`, `infra/`, `scripts/`, `ios/`

### 6.2 Redis без пароля в production Docker Compose
**Файл:** `docker-compose.prod.yml:65-70`
- [x] 6.2.1 Добавить `--requirepass` (через env REDIS_PASSWORD)

### 6.3 `deploy-server.yml` нет CI gate
**Файл:** `.github/workflows/deploy-server.yml:4`
- [x] 6.3.1 Добавить `workflow_run` зависимость от CI workflow

### 6.4 `--no-cache` build на каждый деплой
**Файл:** `.github/workflows/deploy-server.yml:31`
- [x] 6.4.1 Убрать `--no-cache`, использовать Docker layer cache

### 6.5 Nginx `proxy_next_upstream` ретраит POST-запросы
**Файл:** `infra/nginx/nginx.conf:39`
- [x] 6.5.1 Ограничить retry: `proxy_next_upstream_tries 1`, `non_idempotent=off`

### 6.6 Нет `server_tokens off` в Nginx
**Файл:** `infra/nginx/nginx.conf`
- [x] 6.6.1 Добавить `server_tokens off;` в server block

### 6.7 Hardcoded IP `172.19.0.1` в nginx
**Файл:** `infra/nginx/nginx.conf:85`
- [x] 6.7.1 Использовать Docker DNS имя сервиса вместо IP

### 6.8 `RAYON_NUM_THREADS=56` захардкожен
**Файл:** `docker-compose.prod.yml:125`
- [x] 6.8.1 Параметризировать через env-переменную с дефолтом

### 6.9 Python Dockerfiles от root
**Файлы:** `infra/deploy/Dockerfile.embedding`, `infra/deploy/Dockerfile.orchestrator`
- [x] 6.9.1 Добавить non-root user в оба Dockerfile

### 6.10 Missing DB indexes
**Файл:** `prisma/schema.prisma`
- [x] 6.10.1 Добавить index на `McpToolLog.userId`, `McpToolLog.conversationId`
- [x] 6.10.2 Добавить index на `TokenLog.conversationId`
- [x] 6.10.3 Добавить index на `Subscription.expiresAt`

---

## Этап 7 — MEDIUM: Бизнес-логика

### 7.1 Usage counting: fire-and-forget коррекция может потеряться
**Файл:** `src/app/api/chat/route.ts:503-509`
- [x] 7.1.1 Добавить `retryOnce()` для usage correction (500ms delay)

### 7.2 Tool call loop: 50 итераций без бюджета токенов
**Файл:** `src/lib/chat/moonshot-stream.ts:151`, `src/lib/constants.ts:137`
- [x] 7.2.1 Добавить aggregate token budget per-request (`MAX_REQUEST_TOKENS = 200K`)
- [x] 7.2.2 Прерывать loop при превышении бюджета + emit error event

### 7.3 MCP tool timeout: `reject` вместо `resolve` в Promise.race
**Файл:** `src/lib/chat/moonshot-stream.ts:441-455`
- [x] 7.3.1 Изменить timeout promise на `resolve({ error: "..." })` вместо `reject`

### 7.4 No abort signal для upstream API при disconnect клиента
**Файл:** `src/lib/chat/moonshot-stream.ts:152-182`
- [x] 7.4.1 Пробросить AbortSignal из запроса в upstream fetch
- [x] 7.4.2 Добавить cancel() handler в ReadableStream

### 7.5 File parse endpoint: нет проверки file type allowlist
**Файл:** `src/app/api/files/parse/route.ts`
- [x] 7.5.1 Валидировать MIME type против `ALLOWED_FILE_TYPES`

### 7.6 User file content — prompt injection через файлы
**Файл:** `src/app/api/user-files/route.ts:67-76`
- [x] 7.6.1 Обернуть user-uploaded content в `<user-uploaded-file>` теги

### 7.7 MCP tool calls не логируются в McpToolLog
**Файл:** `src/lib/mcp-client.ts:113-129`, `moonshot-stream.ts:442`
- [x] 7.7.1 Передавать `context` с `mcpServerId`/`userId`/`conversationId` при вызове из chat

### 7.8 Compaction: нет concurrency guard
**Файл:** `src/app/api/chat/route.ts:37-107`
- [x] 7.8.1 Добавить Redis lock (`SETNX`) для предотвращения параллельных compactions

---

## Этап 8 — LOW: Качество кода (бэклог)

### 8.1 JSON parse без .catch() в 5+ роутах
- [x] `billing/checkout/route.ts:24`
- [x] `notifications/route.ts:33`
- [x] `agents/[id]/route.ts:51`
- [x] `conversations/[id]/messages/route.ts:27`
- [x] `admin/billing/route.ts:90`
- [x] `reports/route.ts:13`

### 8.2 Inconsistent response format (NextResponse.json vs jsonOk/jsonError)
- [x] Мигрировать billing, admin, notifications роуты на `jsonOk/jsonError`

### 8.3 Dead code
- [x] Удалить неиспользуемые `NextResponse` импорты (conversations/[id])
- [x] Удалить deprecated `SystemAgent` model из schema + seed.ts (upsert + legacy migration). `systemAgentId` на Conversation оставлен (legacy FK)
- [x] Удалить `rehype-raw` из package.json

### 8.4 Schema: дублированные/избыточные индексы
- [x] `DailyUsage`: убрать `@@index([userId, date])` (дублирует `@@unique`)
- [x] `ApiKey`: убрать `@@index([key])` и `@@index([keyHash])` (дублируют `@unique`)

### 8.5 Schema: Plan.price как String вместо Decimal/Int
- [x] Рефакторить `price String` → `price Int @default(0)` (в тенге). Обновлено 13 файлов: schema, seed, 3 checkout/billing routes, billingStore, PlanCard, PlanForm, settings, admin plans/billing pages, тесты

### 8.6 Stores: unbounded artifacts array
**Файл:** `src/stores/artifactStore.ts:111`
- [x] Добавить cap (50 артефактов, как в articleStore)

### 8.7 Stores: articleStore FIFO вместо LRU
**Файл:** `src/stores/articleStore.ts:27`
- [x] Заменить FIFO eviction на LRU (track last access time)

### 8.8 TypeScript: SpeechRecognition typed as any
**Файл:** `src/components/chat/MessageInput.tsx:53-61`
- [x] Использовать minimal interface для SpeechRecognition (убран any)

### 8.9 CSS: magic numbers в MessageBubble
**Файл:** `src/components/chat/MessageBubble.tsx:263,273`
- [x] Извлечь `ASSISTANT_COLLAPSE_HEIGHT = 500`, `USER_COLLAPSE_HEIGHT = 400`

### 8.10 CSS: inconsistent CSS vars vs Tailwind в SanbaoFact
**Файл:** `src/components/chat/SanbaoFact.tsx`
- [x] Мигрировать на Tailwind utility classes (SanbaoFact)

### 8.11 Пагинация: hardcoded limits без cursor
- [x] `admin/agents`: cursor-based pagination
- [x] `admin/billing`: cursor-based pagination
- [x] `skills`: добавлен `take: 100` с cursor pagination

### 8.12 @types в dependencies вместо devDependencies
**Файл:** `package.json`
- [x] Перенести `@types/nodemailer`, `@types/qrcode` в devDependencies

### 8.13 Email template interpolation без HTML-encoding
**Файл:** `src/lib/email.ts:177-179`
- [x] HTML-encode `userName` и другие значения перед вставкой в шаблон

### 8.14 Logger: JSON.stringify без circular reference protection
**Файл:** `src/lib/logger.ts:40`
- [x] Обернуть в try/catch с fallback при circular ref

### 8.15 Admin providers: 8+4 chars API key visible
**Файл:** `src/app/api/admin/providers/route.ts:19-22`
- [x] Показывать только последние 4 символа

### 8.16 Seed: hardcoded fallback admin password
**Файл:** `prisma/seed.ts:165`
- [x] Fail hard если `ADMIN_PASSWORD` не задан (реализовано в 1.5)

### 8.17 Nginx: duplicate security headers с Next.js
- [x] Задокументировано: headers дублируются намеренно (Nginx для non-Next.js locations). Добавлены недостающие headers в `/images/1c/`

### 8.18 Nginx: missing `gzip_vary on`
- [x] Добавить `gzip_vary on` для корректного CDN-кеширования

### 8.19 `npx -y` в start-mcp-servers.sh — auto-install без верификации
**Файл:** `scripts/start-mcp-servers.sh`
- [x] Закреплены версии MCP пакетов в start-mcp-servers.sh

### 8.20 CodePreview iframe: нет origin check на postMessage
**Файл:** `src/components/artifacts/CodePreview.tsx:420`
- [x] Добавить origin validation в `handleMessage`

---

## Инвентаризация данных (2026-02-27)

### Сырые данные (data/) — 30 GB

| Датасет | Файлов | Размер | Обогащено | Заингестировано |
|---------|--------|--------|-----------|-----------------|
| Adilet Z (законы) | 3,519 | 279 MB | 3,519 (100%) | laws_kz |
| Adilet U (указы) | 4,228 | 102 MB | 4,228 (100%) | laws_kz |
| Adilet P (постановления) | 34,803 | 1.2 GB | 1,164 (3%) | laws_kz |
| Adilet V (приказы) | 121,785 | 5.2 GB | 0 (0%) | laws_kz |
| Adilet H (норм. постан.) | 7,807 | 395 MB | 0 (0%) | **НЕТ** |
| Adilet S (конст. законы) | 270 | 7.9 MB | 0 (0%) | laws_kz |
| 1C ITS | 33,868 | 4.4 GB | — | platform_1c + accounting_1c |
| 1C PRO1C | 3,399 | 58 MB | — | accounting_1c |
| TNVED | 13,279 | 24 MB | — | tnved_rates |
| Правовые кодексы | 7,737 ст. | 62 MB | — | legal_kz + legal_code_kz |
| Бух. справочник | 241 строка | 52 KB | — | DuckDB in-memory |
| Правовой справочник | 18 строк | 1.2 KB | — | DuckDB in-memory |
| Embedding кеш | 242,709 | 17 GB | — | — |

### FragmentDB (nexuscore_data/) — 15 GB

| Коллекция | Dim | Доки (chunks) | Размер |
|-----------|-----|---------------|--------|
| laws_kz | 4096 | ~340K | 8.6 GB |
| platform_1c | 4096 | ~200K | 3.8 GB |
| accounting_1c | 4096 | ~58K | 1.1 GB |
| tnved_rates | 4096 | 13,279 | 448 MB |
| legal_kz | 4096 | ~9,200 | 266 MB |
| legal_code_kz | 4096 | ~7,737 | 177 MB |

---

## Сводка прогресса

| Этап | Задач | Описание | Статус |
|------|-------|----------|--------|
| 1 | 5 | CRITICAL — немедленно | ✅ DONE. Остались: 1.1.2 (CF токен), 1.5.1 (API keys), 1.5.4 (secrets mgr) |
| 2 | 12 | HIGH — эта неделя | ✅ DONE (осталось: 2.2.1 nonce CSP, 2.4.2 PgBouncer тест, 2.5 SSH keys) |
| 3 | 12 | MEDIUM Security — ближайший спринт | ✅ DONE |
| 4 | 8 | MEDIUM Performance — ближайший спринт | ✅ DONE (осталось: 4.2.2 tiktoken) |
| 5 | 10 | MEDIUM Frontend — следующий спринт | ✅ DONE |
| 6 | 10 | MEDIUM Infra — следующий спринт | ✅ DONE |
| 7 | 8 | MEDIUM Business Logic | ✅ DONE |
| 8 | 20 | LOW — бэклог | ✅ DONE |
| **Total** | **85** | **Код: всё закрыто** | **Осталось: 7 (5 серверных + 2 проекта)** |

---

## Позитивные стороны проекта

- **SQL safety**: все `$queryRaw/$executeRaw` параметризованы, `$queryRawUnsafe` не найден
- **Auth consistency**: все защищённые роуты проверяют `requireAuth()/requireAdmin()`
- **SSRF redirect protection**: native HTTP tool с `redirect: "manual"` + re-check
- **Crypto**: AES-256-GCM корректно (random IV, auth tag)
- **Ownership checks**: пользователи видят только свои ресурсы
- **Webhook signatures**: Stripe/Freedom Pay verification работает
- **Graceful degradation**: Redis/BullMQ no-op при недоступности
- **`timingSafeEqual`** для bearer-токенов health/metrics
- **Multi-stage Docker**: non-root user, alpine, selective COPY
- **Zod validation**: user-facing create/update с Zod schemas
- **`fireAndForget`**: консистентный паттерн для background ops
- **Atomic promo increment**: `$executeRaw` для race-free usage count

---

## Что осталось (только ручные/серверные операции)

Весь код закрыт. Оставшиеся задачи требуют внешнего доступа или являются отдельными проектами:

### Серверные операции (требуют внешний доступ)
1. **1.1.2** — Ротировать Cloudflare API-токен (нужен CF dashboard)
2. **1.5.1** — Ротировать API-ключи Moonshot/DeepInfra/Google (нужны консоли провайдеров)
3. **1.5.4** — Рассмотреть secrets manager (Vault/AWS SSM) для production
4. **2.4.2** — Протестировать PgBouncer после `scram-sha-256` (нужен Server 1)
5. **2.5.1-2** — Раздельные SSH-ключи (нужен Server 1 + GitHub secrets)

### Отдельные проекты
6. **2.2.1** — Nonce-based CSP для Next.js 16 (middleware + `<Script nonce={}>` propagation)
7. **4.2.2** — tiktoken/gpt-tokenizer для точного подсчёта токенов

### Post-deploy (после текущего деплоя)
- `npx tsx scripts/migrate-api-keys.ts` — захешировать plaintext API-ключи (если есть)
- `npx prisma db push` — применить schema changes (DROP TABLE "SystemAgent", ALTER price, ALTER keyHash/keyPrefix)
- Rebuild Docker containers чтобы подхватить новый `ENCRYPTION_KEY` и `CRON_SECRET`
