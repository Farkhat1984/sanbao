# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** Before any infrastructure or deploy work, read `docs/DEVOPS.md` — it has full docs on servers, ports, services, env vars, CI/CD, Telegram bot, and troubleshooting.

## Commands

```bash
npm run dev          # Dev server (port from env or 3000)
npm run build        # Production build (standalone output)
npm run start        # Start production server
npm run lint         # ESLint (next core-web-vitals + typescript)
npm run test         # Vitest unit tests (all)
npm run test:watch   # Vitest in watch mode
npx vitest run src/__tests__/lib/parse-file.test.ts  # Run single test file
npx prisma db push   # Sync schema to DB (no migrations)
npx prisma migrate deploy  # Apply migrations (production)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db seed   # Seed plans, admin user, system agents, default models/skills
npx prisma studio    # Visual DB browser
```

### Deploy (production)

```bash
./scripts/deploy.sh              # Full rebuild (build + restart all + healthcheck)
./scripts/deploy.sh app          # Rebuild only app containers + restart nginx
./scripts/deploy.sh cortex       # Rebuild AI Cortex stack
./scripts/deploy.sh restart      # Restart without rebuild
./scripts/deploy.sh status       # Show container status
./scripts/deploy.sh logs [svc]   # Tail logs (default: app)
```

After code changes, use `./scripts/deploy.sh app` for fastest production update.
Deploy auto-wraps in tmux (survives SSH disconnect). Logs: `logs/deploy/`.

### Operations testing

```bash
./scripts/ops-test.sh            # Interactive menu (9 scenarios)
./scripts/ops-test.sh all        # All tests except failover
./scripts/ops-test.sh health     # Both servers health check
./scripts/ops-test.sh failover   # Full failover drill (causes downtime!)
```

Tests live in `src/__tests__/` (not colocated). Vitest config: jsdom environment, 15s timeout, setup file at `src/__tests__/setup.ts`.

Docker: `docker compose up --build` — runs PostgreSQL 16 + PgBouncer + Redis + app on port 3004.
Production: `docker compose -f docker-compose.prod.yml up -d` — adds Nginx LB + 3 app replicas.

## Architecture

**Sanbao** — универсальный AI-ассистент (Next.js 16.1, App Router, React 19 with React Compiler, TypeScript, Tailwind CSS v4, PostgreSQL 16, Redis 7, BullMQ).

### Routing

- `src/app/(app)/` — основное приложение (13 страниц): `/chat`, `/chat/[id]`, `/profile`, `/settings`, `/skills`, `/skills/new`, `/skills/[id]/edit`, `/skills/marketplace`, `/agents`, `/agents/new`, `/agents/[id]/edit`, `/billing`, `/mcp`
- `src/app/(auth)/` — аутентификация: `/login`, `/register`
- `src/app/(admin)/admin/` — админ-панель (29 страниц): dashboard, users, agents, tools, plugins, skills, mcp, models, models/matrix, providers, plans, billing, usage, analytics, experiments, settings, notifications, webhooks, promo-codes, templates, email, api-keys, sessions, logs, errors, files, moderation, agent-moderation, health
- `src/app/(legal)/` — юридические страницы: `/terms`, `/privacy`, `/offer`
- `src/app/api/` — 107 route-файлов: chat, conversations, agents, tools, plugins, skills, tasks, memory, billing (stripe + freedom), admin/*, auth (2fa, nextauth, register, apple, mobile/google), health, ready, metrics, notifications, reports, user, user-files, files, mcp, image-generate, image-edit, fix-code

### Streaming Protocol

`POST /api/chat` → NDJSON stream of `{t, v}` objects:
- `c` content, `r` reasoning, `p` plan, `s` status (search/tool), `x` context info, `e` error

Chat logic split across 4 files (~1600 lines total):
- `src/app/api/chat/route.ts` (~780 lines) — main handler, system prompt, tool dispatch
- `src/lib/chat/moonshot-stream.ts` (~510 lines) — Moonshot/Kimi SSE with tool calling
- `src/lib/chat/ai-sdk-stream.ts` (~200 lines) — OpenAI via Vercel AI SDK
- `src/lib/chat/message-builder.ts` (~66 lines) — message/attachment formatting

### Custom Tag System

AI responses contain `sanbao-*` tags parsed by the client:
- `<sanbao-doc type="" title="">` — artifact creation
- `<sanbao-edit target="">` — document edits
- `<sanbao-plan>` — planning block (also extracted to `p` stream type)
- `<sanbao-task title="">` — task checklist
- `<sanbao-clarify>` — JSON questions before creating a document

Tags are defined in `SYSTEM_PROMPT` inside `src/app/api/chat/route.ts`. When adding a new tag: define regex → parse in MessageBubble → hide raw tag from output.

### AI Providers & Model Router

- `src/lib/model-router.ts` → `resolveModel(category, planId?)` — dynamic model selection from DB
- Resolution priority: plan default → plan-model mapping → global default → env fallback
- Categories: TEXT, IMAGE, VOICE, VIDEO, CODE, EMBEDDING
- `PlanModel` — ties plans to specific models; A/B experiments via `src/lib/ab-experiment.ts`
- Provider routing via `AiProvider.apiFormat` enum: `OPENAI_COMPAT` | `AI_SDK_OPENAI`

### Context Management

`src/lib/context.ts`: `estimateTokens()`, `checkContextWindow()`, `splitMessagesForCompaction()`. Automatic background compaction → `ConversationSummary` in DB. `buildSystemPromptWithContext()` enriches system prompt with summary + plan memory + user memory. Compaction threshold: 70%, keeps last 12 messages.

### State Management

11 Zustand stores in `src/stores/`: chatStore, artifactStore, articleStore, panelStore, sidebarStore, taskStore, agentStore, skillStore, memoryStore, billingStore, onboardingStore.

### Security

- **Auth:** NextAuth v5, JWT, Credentials + Google OAuth + Apple Sign In (mobile), 2FA TOTP (`otplib` OTP class)
- **Mobile auth:** `src/lib/mobile-auth.ts` (JWKS token verification via `jose`), `src/lib/mobile-session.ts` (NextAuth-compatible JWT minting, 30-day expiry). Endpoints: `POST /api/auth/apple`, `POST /api/auth/mobile/google` — verify provider ID tokens, upsert user + account, return Bearer token. Apple bundle ID: `com.sanbao.sanbaoai`. Google audiences: `AUTH_GOOGLE_ID` (web) + `GOOGLE_SERVER_CLIENT_ID` + `GOOGLE_IOS_CLIENT_ID` + `GOOGLE_ANDROID_CLIENT_ID`
- **Bearer-to-Cookie bridge:** `src/proxy.ts` middleware converts `Authorization: Bearer <token>` → NextAuth session cookie for mobile API clients
- **Middleware:** `src/proxy.ts` (~135 lines, Edge Runtime) — auth wrapper, Bearer-to-Cookie bridge, admin IP whitelist, suspicious path blocking, correlation ID (`x-request-id`) generation
- **CSP:** Content-Security-Policy header via `next.config.ts` (dynamic CDN/Sentry/Cloudflare domains)
- **Admin guard:** `src/lib/admin.ts` → `requireAdmin()` — role + 2FA + IP whitelist
- **Rate-limit:** `src/lib/rate-limit.ts` — Redis-first with in-memory fallback, auto-block on abuse (10 violations → 30 min block)
- **API keys:** `src/lib/crypto.ts` AES-256-GCM; `src/lib/api-key-auth.ts` — per-key rate limit
- **Content filter:** `src/lib/content-filter.ts` — SystemSetting-based with in-memory cache
- **SSRF protection:** `src/lib/ssrf.ts`, `src/lib/webhook-dispatcher.ts`, `src/lib/tool-executor.ts`, `src/app/api/mcp/route.ts` — blocked private IP ranges
- **Input validation:** `src/lib/validation.ts`; messages (max 200, 100KB/msg), MCP tools (max 100), email (254 chars), stream buffer (1MB cap)

### Data Layer

- **Prisma + PostgreSQL** — `prisma/schema.prisma`, 55 models, 14 enums
- **PgBouncer** — connection pooling (transaction mode, pool 50)
- **Read replicas** — `src/lib/prisma.ts` uses `@prisma/extension-read-replicas` when `DATABASE_REPLICA_URL` is set
- Seed script (`prisma/seed.ts`): creates Free/Pro/Business plans, admin user, 4+ system agents (Sanbao, Legal, Customs, Accounting + specialized), 40+ tools with templates, Moonshot/DeepInfra providers, 3 AI models (Kimi K2.5, Flux Schnell, Qwen Image Edit), 4 built-in skills
- **Audit:** `src/lib/audit.ts` — `logAudit()`, `logError()`, `logTokenUsage()`
- **Billing:** Plan → Subscription (trialEndsAt) → DailyUsage; `Plan.maxStorageMb` for file quota; Stripe + Freedom Pay (`src/lib/freedom-pay.ts`)
- **Email:** `src/lib/email.ts` (Nodemailer), templates with `{{varName}}` interpolation
- **Webhooks:** `src/lib/webhook-dispatcher.ts` — dispatch + retry + WebhookLog + SSRF protection
- **Invoices:** `src/lib/invoice.ts` — PDF invoice generation with QR codes

### Redis & Caching

- `src/lib/redis.ts` — Redis client (ioredis) with graceful degradation (no-op if `REDIS_URL` not set)
- `cacheGet()`, `cacheSet()`, `cacheDel()`, `cacheIncr()`, `redisRateLimit()` — all return null/no-op when unavailable
- `src/lib/usage.ts` — plan+usage cache in Redis (30s TTL, key `plan:${userId}`)
- **Two-level agent context cache:** L1 in-memory BoundedMap (30s) + L2 Redis (60s, key `agent_ctx:{id}`), shared across replicas
- Rate limiting: distributed via Redis, fallback to in-memory BoundedMap (`src/lib/bounded-map.ts`)

### Job Queues

- `src/lib/queue.ts` — BullMQ queues with inline fallback when Redis unavailable
- `src/lib/workers.ts` — processors for `webhook` and `email` queues
- `src/lib/shutdown.ts` — graceful shutdown: drain connections → close queues → close Redis
- `src/instrumentation.ts` — Next.js instrumentation hook, bootstraps workers + shutdown on server start

### Agent → Tool → Plugin Hierarchy

Universal metadata-driven system. All agents (system and user) use the same `Agent` table (`isSystem` flag distinguishes them).

- **Tool** (`src/lib/tool-resolver.ts`): types PROMPT_TEMPLATE | WEBHOOK | URL | FUNCTION. Config: `{prompt, templates?: [{id, name, description, fields, promptTemplate}]}`
- **Plugin**: bundles of Tools + Skills + MCP servers
- **Junction tables**: AgentTool, AgentPlugin, PluginTool, PluginSkill, PluginMcpServer, SkillTool
- **resolveAgentContext(agentId)** → `{systemPrompt, promptTools[], mcpTools[], skillPrompts[]}` — traverses full hierarchy with deduplication
- **tool-executor.ts**: executes WEBHOOK/URL/FUNCTION tools with `{{key}}` interpolation
- **API routes**: `/api/tools`, `/api/plugins`, `/api/agents/[id]/tools`, `/api/admin/tools`, `/api/admin/plugins`
- **Frontend**: agentStore.agentTools loaded in ChatArea, consumed by WelcomeScreen, ToolsPanel, MessageInput
- **Legacy compat**: `resolveAgentId()` maps old "system-lawyer"/"system-femida" → "system-femida-agent". Constants: `LAWYER_ID`, `LAWYER_AGENT_ID`, `BROKER_AGENT_ID`, `SANBAO_AGENT_ID` + legacy aliases `FEMIDA_ID`, `FEMIDA_AGENT_ID`

### Native Tools

Built-in tools executed server-side without external calls. Dispatch order in `route.ts`: MCP tools → Native tools → `$web_search`.

- **Registry:** `src/lib/native-tools/registry.ts` — `registerNativeTool()`, avoids circular deps
- **Entry:** `src/lib/native-tools.ts` — re-exports + side-effect imports of all tool modules
- **Modules:** `system.ts` (time, user info, context), `http-request.ts`, `productivity.ts` (tasks, memory, notifications, scratchpad), `analysis.ts` (calculate, CSV, chart data), `content.ts` (read/search knowledge)
- **14 tools:** `http_request`, `get_current_time`, `get_user_info`, `get_conversation_context`, `create_task`, `save_memory`, `send_notification`, `write_scratchpad`, `read_scratchpad`, `calculate`, `analyze_csv`, `read_knowledge`, `search_knowledge`, `generate_chart_data`
- Tool call loop max 50 iterations (`NATIVE_TOOL_MAX_TURNS` in constants.ts)
- Stream phase `using_tool` via `{t:"s", v:"using_tool"}`
- Adding a new native tool: create function in appropriate module → call `registerNativeTool()` → it auto-registers on import

### MCP Integration

- `src/lib/mcp-client.ts` — connects to MCP servers via `@modelcontextprotocol/sdk`
- **AI Cortex** — sibling project at `../ai_cortex` (FragmentDB + Orchestrator). See cross-project section below.
- **Env:** `LAWYER_MCP_URL`, `BROKER_MCP_URL`, `ACCOUNTINGDB_MCP_URL`, `CONSULTANT_1C_MCP_URL` (all default to `http://orchestrator:8120/...` in seed.ts)
- **FragmentDB collections:** legal_kz (7,463 articles), laws_kz (~344K laws), tnved_rates (13,279 codes), accounting_1c (~20.7K chunks), platform_1c (~39K chunks)
- **article:// protocol:** `[label](article://{code}/{id})` — opens articles in UnifiedPanel. Supports: 18 legal codes, laws (doc_code), 1c/1c_buh (article_id)
- **Admin toggle:** `McpServer.isEnabled` controls user visibility
- **User toggle:** `UserMcpServer` junction table — users opt in/out of global MCPs
- `route.ts` loads user-enabled global MCPs + user's own connected MCPs
- User pages: `/mcp` for managing personal MCP connections
- **MCP tool namespace dedup:** when multiple MCP servers expose tools with identical names (e.g. `search`), `route.ts` auto-prefixes them with URL path segment (`accountant_search`, `lawyer_search`). `McpToolContext.originalName` stores the original name for dispatch via `callMcpTool()`
- **SSRF protection** on MCP server URL registration

### Cross-Project: AI Cortex Integration

Sanbao and AI Cortex (`/home/faragj/faragj/ai_cortex`) are **two sibling repos** that run in the **same Docker Compose project**. The `docker-compose.prod.yml` in this repo builds and manages both stacks.

**Repo layout:**
```
/home/faragj/faragj/
├── sanbao/                  ← this repo (Next.js app)
│   └── docker-compose.prod.yml  ← manages ALL containers (sanbao + ai_cortex)
└── ai_cortex/               ← FragmentDB + Orchestrator (Rust + Python)
    ├── fragmentdb_data/     ← persistent data dir (mounted into container)
    └── data/                ← ingested knowledge bases, images
```

**All containers — single compose project `sanbao`, network `sanbao_default`:**

| Container | Service | Internal Port | Host Port | Docker DNS |
|---|---|---|---|---|
| `sanbao-nginx-1` | nginx | 80 | **3004** | `nginx` |
| `sanbao-app-{4,5,6}` | app (×3 replicas) | 3004 | — | `app` |
| `sanbao-db-1` | db (PostgreSQL 16) | 5432 | — | `db` |
| `sanbao-pgbouncer-1` | pgbouncer | 5432 | — | `pgbouncer` |
| `sanbao-redis-1` | redis | 6379 | — | `redis` |
| `sanbao-embedding-proxy-1` | embedding-proxy | 8097 | **8097** | `embedding-proxy` |
| `sanbao-fragmentdb-1` | fragmentdb | **8080** | **8110** | `fragmentdb` |
| `sanbao-orchestrator-1` | orchestrator | **8120** | **8120** | `orchestrator` |

**CRITICAL port mapping: FragmentDB listens on 8080 inside Docker, mapped to 8110 on host.** Orchestrator connects via Docker DNS: `http://fragmentdb:8080` (NOT 8110). App connects to orchestrator via: `http://orchestrator:8120/lawyer` etc.

**Never run FragmentDB as a standalone container or bare process** — it must be in the `sanbao_default` network for the orchestrator to resolve it. Always use `docker compose -f docker-compose.prod.yml up -d fragmentdb`.

**4 MCP endpoints (Orchestrator v0.9.0):**

| Endpoint | Agent | DB records |
|---|---|---|
| `http://orchestrator:8120/lawyer` | Юрист — Kazakhstan Legal | `mcp-lawyer` |
| `http://orchestrator:8120/broker` | Брокер — Customs/TNVED | `mcp-broker` |
| `http://orchestrator:8120/accountant` | Бухгалтер — 1С Accounting KZ | `mcp-accountingdb` |
| `http://orchestrator:8120/consultant_1c` | 1С Консультант — Platform | `mcp-consultant-1c` |

**Dependency chain:** `embedding-proxy` → `fragmentdb` (healthy) → `orchestrator` (healthy) → `app` (healthy) → `nginx`

**Restart commands:**
```bash
# Restart just AI Cortex stack:
docker compose -f docker-compose.prod.yml restart fragmentdb
docker compose -f docker-compose.prod.yml restart orchestrator

# Rebuild AI Cortex (after code changes in ../ai_cortex):
docker compose -f docker-compose.prod.yml up -d --build fragmentdb orchestrator

# Full stack restart:
docker compose -f docker-compose.prod.yml up -d

# Check connectivity:
docker exec sanbao-orchestrator-1 curl -sf http://fragmentdb:8080/health
docker exec sanbao-app-4 wget -qO- http://orchestrator:8120/health
```

**Health checks:**
- FragmentDB: `curl http://localhost:8110/health` → `FragmentDB v0.5.0 — OK`
- Orchestrator: `curl http://localhost:8120/health` → `{"status":"ok","version":"0.9.0",...}`
- App → Orchestrator: `docker exec sanbao-app-4 wget -qO- http://orchestrator:8120/health`

### Export System

- `src/lib/export-docx.ts` — DOCX export (rich formatting, tables, headers)
- `src/lib/export-xlsx.ts` — XLSX spreadsheet export
- `src/lib/export-pdf.ts` — PDF export via html2canvas + jsPDF
- `src/lib/export-utils.ts` — format detection, TXT/HTML export, common utilities

### Logging

- `src/lib/logger.ts` — structured JSON logger in production, readable console in dev
- `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()` — all with metadata
- Auto-includes `requestId` (correlation ID) from `AsyncLocalStorage` when available
- `src/lib/correlation.ts` — `AsyncLocalStorage`-based context, `generateCorrelationId()`, `runWithCorrelationId()`
- `LOG_FORMAT=json` (default in prod), `LOG_LEVEL=info` (configurable)
- Legacy helpers: `logWarn()`, `logError()`, `fireAndForget()` — backward-compatible wrappers

### Monitoring

- `GET /api/health` — full liveness check (DB, Redis, AI providers, MCP). Returns 503 during shutdown
- `GET /api/ready` — lightweight readiness probe (DB `SELECT 1` + Redis ping). Used by k8s readinessProbe
- `GET /api/metrics` — Prometheus-compatible metrics (business, process, Redis, request duration histogram)
- `src/lib/request-metrics.ts` — in-memory request duration tracking with histogram buckets
- Grafana dashboard auto-provisioned via `infra/k8s/monitoring/grafana.yml`
- 7 Prometheus alert rules in `infra/k8s/monitoring/prometheus.yml`

### Infrastructure

- **Docker:** Multi-stage Dockerfile (deps → build → prisma-cli → runner), port 3004
- **Docker Compose:** dev (db + pgbouncer + redis + app), prod (+ nginx + 3 replicas + AI Cortex stack). See "Cross-Project: AI Cortex Integration" section for full container map.
- **Nginx:** `infra/nginx/nginx.conf` — least_conn LB, rate limiting (30r/s general, 10r/s chat), SSE support, static caching, `X-Forwarded-Proto: https` (hardcoded — behind Cloudflare SSL)
- **Kubernetes:** full manifests in `infra/k8s/` — deployment, HPA (3-20 pods), PDB, ingress, network policies (6 rules)
- **Canary:** Argo Rollouts manifest (`infra/k8s/canary-rollout.yml`) — 10→30→60→100% with pauses
- **CI/CD:** `.github/workflows/` — CI (lint + test + build), Deploy (image → registry → k8s), Deploy-Server (SSH to prod servers + Telegram notify)
- **Backups:** CronJob (`infra/k8s/backup-cronjob.yml`) — daily pg_dump → S3, 30-day retention
- **CDN:** `assetPrefix` in `next.config.ts`, upload script `scripts/upload-static.sh`
- **Sentry:** `sentry.{client,server,edge}.config.ts` — active only when `SENTRY_DSN` is set
- **MCP servers:** `scripts/start-mcp-servers.sh` — orchestrates 5 MCP servers via supergateway (GitHub, PostgreSQL, Brave Search, Filesystem, Playwright)

### Key Patterns

- **Admin API routes:** `const result = await requireAdmin(); if (result.error) return result.error;`
- **Async params (Next.js 16):** `{ params }: { params: Promise<{ id: string }> }`
- **Fire-and-forget:** `fireAndForget(promise, context)` from `src/lib/logger.ts`
- **Graceful degradation:** Redis/BullMQ operations return null/no-op when unavailable (dev works without Redis)
- **In-memory cache with TTL:** content-filter, IP whitelist, model resolution, A/B experiments
- **SystemSetting key-value:** global config table with cache invalidation
- **serverExternalPackages** in `next.config.ts`: @napi-rs/canvas, otplib, qrcode, bcryptjs, stripe, nodemailer, @aws-sdk/*, mammoth, pdf-parse, xlsx, officeparser, ioredis, bullmq, @sentry/nextjs

### Key Libraries

- **ioredis** — Redis client with reconnect, graceful degradation
- **bullmq** — job queues (webhook dispatch, email sending)
- **@sentry/nextjs** — error tracking + performance (client/server/edge)
- **@prisma/extension-read-replicas** — read query routing to replica DB
- **otplib** (v13) — `OTP` class: `generateSecret()`, `verify({token, secret})`, `generateURI({issuer, label, secret})`
- **stripe** — Checkout Session, webhook `constructEvent`
- **@aws-sdk/client-s3** — S3/MinIO upload/delete/presigned URL (`src/lib/storage.ts`)
- **Tiptap** (v3) — rich text editor (starter-kit, react, table, highlight, text-align)
- **react-markdown + remark-gfm + rehype-highlight + rehype-raw** — markdown rendering
- **docx / jspdf / html2canvas-pro** — document export; **mammoth / pdf-parse / xlsx / officeparser** — file parsing
- **@modelcontextprotocol/sdk** — MCP server connections (`src/lib/mcp-client.ts`)
- **@napi-rs/canvas + qrcode** — server-side image generation (invoices, QR)
- **jose** — JWKS-based JWT verification for Apple/Google mobile auth (`src/lib/mobile-auth.ts`)
- **framer-motion** — spring-based animations

### Frontend Structure

- **17 component directories** in `src/components/`: admin, agents, artifacts, billing, chat, image-edit, layout, legal-tools, memory, onboarding, panel, providers, settings, sidebar, skills, tasks, ui
- **69 component files** (.tsx)
- **2 hooks** in `src/hooks/`: `useIsMobile.ts` (responsive breakpoint), `useTranslation.ts` (i18n hook)
- **Error boundaries:** `error.tsx` in (app) and (admin) route groups; no loading.tsx or not-found.tsx

### Path Alias

`@/*` → `./src/*` (tsconfig paths).

## Style Guide

Design system **Soft Corporate Minimalism** — details in `docs/STYLEGUIDE.md`. Key rules:
- Backgrounds never pure white/black — always with a slight blue tint
- Color tokens via CSS variables (`--bg`, `--accent`, `--text-primary`, etc.)
- Border radius: 12px buttons, 16px cards/modals, 32px chat input
- Spring-based animations (Framer Motion): damping 25, stiffness 300
- Gradients only for 1–2 CTAs per screen

UI text primarily in Russian; Kazakh (kk) locale also supported.

## Localization

- `src/lib/i18n.ts` — lightweight i18n with `t("key")` function; locales: `ru` (Russian), `kk` (Kazakh)
- Messages in `src/messages/ru.json` and `src/messages/kk.json`
- `useTranslation` hook in `src/hooks/useTranslation.ts`
- Dates: `formatDate()` in `src/lib/utils.ts` (Сегодня, Вчера, X дн. назад)
- Default currency: KZT (Kazakhstani Tenge)

## Documentation

- `docs/DEVOPS.md` — servers, ports, CI/CD, Telegram bot, troubleshooting
- `docs/STYLEGUIDE.md` — design system (Soft Corporate Minimalism)
- `docs/ADMINGUIDE.md` — admin panel guide
- `docs/USERGUIDE.md` — user guide
- `docs/ADVERTISING.md` — advertising system
- `docs/FRAGMENTDB_PIPELINE.md` — AI Cortex (FragmentDB v3) integration: MCP endpoints, domains, architecture
- `docs/HOTFIX.md`, `docs/HOTFIX2.md` — historical fixes
