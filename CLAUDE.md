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
npx prisma db seed   # Seed plans, admin user, system agent, default models/skills
npx prisma studio    # Visual DB browser
```

### Deploy (production)

```bash
./scripts/deploy.sh              # Full rebuild (build + restart all + healthcheck)
./scripts/deploy.sh app          # Rebuild only app containers + restart nginx
./scripts/deploy.sh restart      # Restart without rebuild
./scripts/deploy.sh status       # Show container status
./scripts/deploy.sh logs [svc]   # Tail logs (default: app)
```

After code changes, use `./scripts/deploy.sh app` for fastest production update.

Tests live in `src/__tests__/` (not colocated). Vitest config: jsdom environment, 15s timeout, setup file at `src/__tests__/setup.ts`.

Docker: `docker compose up --build` — runs PostgreSQL 16 + PgBouncer + Redis + app on port 3004.
Production: `docker compose -f docker-compose.prod.yml up -d` — adds Nginx LB + 3 app replicas.

## Architecture

**Sanbao** — универсальный AI-ассистент (Next.js 16 App Router, React 19 with React Compiler, TypeScript, Tailwind CSS v4, PostgreSQL, Redis, BullMQ).

### Routing

- `src/app/(app)/` — основное приложение: `/chat`, `/chat/[id]`, `/profile`, `/settings`, `/skills`, `/billing`, `/mcp`
- `src/app/(auth)/` — аутентификация: `/login`, `/register`
- `src/app/(admin)/admin/` — админ-панель (25+ страниц)
- `src/app/api/` — API-роуты: chat, conversations, agents, tools, plugins, skills, tasks, memory, billing, admin/*, auth (2fa), health, metrics, notifications, reports

### Streaming Protocol

`POST /api/chat` → NDJSON stream of `{t, v}` objects:
- `c` content, `r` reasoning, `p` plan, `s` search status, `x` context info, `e` error

Two code paths in route.ts (~1100 lines):
- **Moonshot (Kimi K2.5):** Custom SSE handler with tool calling (web search via `$web_search`, MCP tools)
- **OpenAI / Anthropic:** Vercel AI SDK (`streamText`)

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

### Context Management

`src/lib/context.ts`: `estimateTokens()`, `checkContextWindow()`, `splitMessagesForCompaction()`. Automatic background compaction → `ConversationSummary` in DB. `buildSystemPromptWithContext()` enriches system prompt with summary + plan memory + user memory.

### State Management

Zustand stores in `src/stores/`: chatStore, artifactStore, panelStore, sidebarStore, taskStore, agentStore, skillStore, memoryStore, billingStore, onboardingStore.

### Security

- **Auth:** NextAuth v5, JWT, Credentials + Google OAuth, 2FA TOTP (`otplib` OTP class)
- **Middleware:** `src/proxy.ts` (Edge Runtime) — auth wrapper, admin IP whitelist, suspicious path blocking, correlation ID (`x-request-id`) generation
- **CSP:** Content-Security-Policy header via `next.config.ts` (dynamic CDN/Sentry domains)
- **Admin guard:** `src/lib/admin.ts` → `requireAdmin()` — role + 2FA + IP whitelist
- **Rate-limit:** `src/lib/rate-limit.ts` — Redis-first with in-memory fallback, auto-block on abuse (10 violations → 30 min block)
- **API keys:** `src/lib/crypto.ts` AES-256-GCM; `src/lib/api-key-auth.ts` — per-key rate limit
- **Content filter:** `src/lib/content-filter.ts` — SystemSetting-based with in-memory cache
- **SSRF protection:** `src/lib/webhook-dispatcher.ts`, `src/app/api/mcp/route.ts` — blocked private IP ranges
- **Input validation:** messages (max 200, 100KB/msg), MCP tools (max 100), email (254 chars), stream buffer (1MB cap)

### Data Layer

- **Prisma + PostgreSQL** — `prisma/schema.prisma`, ~52 models, 14 enums
- **PgBouncer** — connection pooling (transaction mode, pool 50)
- **Read replicas** — `src/lib/prisma.ts` uses `@prisma/extension-read-replicas` when `DATABASE_REPLICA_URL` is set
- Seed script (`prisma/seed.ts`): creates Free/Pro/Business plans, admin user, Femida+Sanbao system agents, 11 tools with templates, Moonshot/DeepInfra providers, default AI models, 4 built-in skills
- **Audit:** `src/lib/audit.ts` — `logAudit()`, `logError()`, `logTokenUsage()`
- **Billing:** Plan → Subscription (trialEndsAt) → DailyUsage; `Plan.maxStorageMb` for file quota
- **Email:** `src/lib/email.ts` (Nodemailer), templates with `{{varName}}` interpolation
- **Webhooks:** `src/lib/webhook-dispatcher.ts` — dispatch + retry + WebhookLog + SSRF protection

### Redis & Caching

- `src/lib/redis.ts` — Redis client (ioredis) with graceful degradation (no-op if `REDIS_URL` not set)
- `cacheGet()`, `cacheSet()`, `cacheDel()`, `cacheIncr()`, `redisRateLimit()` — all return null/no-op when unavailable
- `src/lib/usage.ts` — plan+usage cache in Redis (30s TTL, key `plan:${userId}`)
- **Two-level agent context cache:** L1 in-memory BoundedMap (30s) + L2 Redis (60s, key `agent_ctx:{id}`), shared across replicas
- Rate limiting: distributed via Redis, fallback to in-memory BoundedMap

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
- **Legacy compat**: `resolveAgentId()` maps old "system-femida" → "system-femida-agent". SystemAgent table kept (deprecated)

### Native Tools

Built-in tools executed server-side without external calls. Dispatch order in `route.ts`: MCP tools → Native tools → `$web_search`.

- **Registry:** `src/lib/native-tools/registry.ts` — `registerNativeTool()`, avoids circular deps
- **Entry:** `src/lib/native-tools.ts` — re-exports + side-effect imports of all tool modules
- **Modules:** `system.ts` (time, user info, context), `http-request.ts`, `productivity.ts` (tasks, memory, notifications, scratchpad), `analysis.ts` (calculate, CSV, chart data), `content.ts` (read/search knowledge)
- **14 tools:** `http_request`, `get_current_time`, `get_user_info`, `get_conversation_context`, `create_task`, `save_memory`, `send_notification`, `write_scratchpad`, `read_scratchpad`, `calculate`, `analyze_csv`, `read_knowledge`, `search_knowledge`, `generate_chart_data`
- Tool call loop max 5 iterations (`NATIVE_TOOL_MAX_TURNS` in route.ts)
- Stream phase `using_tool` via `{t:"s", v:"using_tool"}`
- Adding a new native tool: create function in appropriate module → call `registerNativeTool()` → it auto-registers on import

### MCP Integration

- `src/lib/mcp-client.ts` — connects to MCP servers via `@modelcontextprotocol/sdk`
- **Admin toggle:** `McpServer.isEnabled` controls user visibility
- **User toggle:** `UserMcpServer` junction table — users opt in/out of global MCPs
- `route.ts` loads user-enabled global MCPs + user's own connected MCPs
- User pages: `/mcp` for managing personal MCP connections
- **SSRF protection** on MCP server URL registration

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

- **Docker:** Multi-stage Dockerfile (deps → build → prisma-cli → runner)
- **Docker Compose:** dev (db + pgbouncer + redis + app), prod (+ nginx + 3 replicas)
- **Nginx:** `infra/nginx/nginx.conf` — least_conn LB, rate limiting (30r/s general, 10r/s chat), SSE support, static caching
- **Kubernetes:** full manifests in `infra/k8s/` — deployment, HPA (3-20 pods), PDB, ingress, network policies
- **Canary:** Argo Rollouts manifest (`infra/k8s/canary-rollout.yml`) — 10→30→60→100% with pauses
- **CI/CD:** `.github/workflows/` — CI (lint + test + build) and Deploy (image → registry → k8s)
- **Backups:** CronJob (`infra/k8s/backup-cronjob.yml`) — daily pg_dump → S3, 30-day retention
- **CDN:** `assetPrefix` in `next.config.ts`, upload script `scripts/upload-static.sh`
- **Sentry:** `sentry.{client,server,edge}.config.ts` — active only when `SENTRY_DSN` is set

### Key Patterns

- **Admin API routes:** `const result = await requireAdmin(); if (result.error) return result.error;`
- **Async params (Next.js 16):** `{ params }: { params: Promise<{ id: string }> }`
- **Fire-and-forget:** `fireAndForget(promise, context)` from `src/lib/logger.ts`
- **Graceful degradation:** Redis/BullMQ operations return null/no-op when unavailable (dev works without Redis)
- **In-memory cache with TTL:** content-filter, IP whitelist, model resolution, A/B experiments
- **SystemSetting key-value:** global config table with cache invalidation
- **serverExternalPackages** in `next.config.ts`: native/Node packages that can't be bundled (canvas, otplib, bcryptjs, stripe, S3, nodemailer, pdf-parse, xlsx, mammoth, ioredis, bullmq, @sentry/nextjs)

### Key Libraries

- **ioredis** — Redis client with reconnect, graceful degradation
- **bullmq** — job queues (webhook dispatch, email sending)
- **@sentry/nextjs** — error tracking + performance (client/server/edge)
- **@prisma/extension-read-replicas** — read query routing to replica DB
- **otplib** (v13) — `OTP` class: `generateSecret()`, `verify({token, secret})`, `generateURI({issuer, label, secret})`
- **stripe** — Checkout Session, webhook `constructEvent`
- **@aws-sdk/client-s3** — S3/MinIO upload/delete/presigned URL (`src/lib/storage.ts`)
- **Tiptap** — rich text editor (with table, highlight, text-align extensions)
- **react-markdown + remark-gfm + rehype-highlight + rehype-raw** — markdown rendering
- **docx / html2pdf.js** — export; **mammoth / pdf-parse / xlsx** — file parsing
- **@modelcontextprotocol/sdk** — MCP server connections (`src/lib/mcp-client.ts`)

### Path Alias

`@/*` → `./src/*` (tsconfig paths).

## Style Guide

Design system **Soft Corporate Minimalism** — details in `docs/STYLEGUIDE.md`. Key rules:
- Backgrounds never pure white/black — always with a slight blue tint
- Color tokens via CSS variables (`--bg`, `--accent`, `--text-primary`, etc.)
- Border radius: 12px buttons, 16px cards/modals, 32px chat input
- Spring-based animations (Framer Motion): damping 25, stiffness 300
- Gradients only for 1–2 CTAs per screen

All UI text is in Russian.

## Localization

Dates: `formatDate()` in `src/lib/utils.ts` (Сегодня, Вчера, X дн. назад).
