# sanbao/ — CLAUDE.md

B2B SaaS AI-assistant for legal, customs, accounting professionals in Kazakhstan.
Next.js 16.1 + React 19 + PostgreSQL 16 + Redis 7 + MCP integration.

---

## Commands

```bash
npm run dev              # Dev server :3004
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Vitest
npx prisma migrate deploy   # Apply migrations
npx prisma generate         # Regenerate client
npx prisma db seed          # Seed (plans, agents, tools, models, skills)
npx prisma studio           # Visual DB browser
```

### Deploy (production)

```bash
./scripts/deploy.sh full      # Full rebuild (app + AI Cortex)
./scripts/deploy.sh app       # App only (rolling restart, fastest)
./scripts/deploy.sh cortex    # AI Cortex stack only
./scripts/deploy.sh restart   # Restart without rebuild
./scripts/deploy.sh status    # Container status
./scripts/deploy.sh logs [svc] # Tail logs
```

Deploy auto-wraps in tmux. Logs: `logs/deploy/`.

---

## Docker (docker-compose.prod.yml)

**11 containers, network `sanbao_default`:**

| Container | Internal | Host | Docker DNS |
|-----------|----------|------|------------|
| nginx | 80 | **127.0.0.1:3004** | nginx |
| app x3 | 3004 | — | app |
| db | 5432 | — | db |
| pgbouncer | 5432 | — | pgbouncer |
| redis | 6379 | — | redis |
| leemadb | **8080** | **127.0.0.1:8110** | leemadb |
| orchestrator | 8120 | **127.0.0.1:8120** | orchestrator |
| embedding-proxy | 8097 | **127.0.0.1:8097** | embedding-proxy |
| ai-cortex-web | 80 | **127.0.0.1:5173** | ai-cortex-web |

**CRITICAL:** LeemaDB = 8080 inside Docker, 8110 on host. App connects to `http://orchestrator:8120`, NEVER directly to LeemaDB.

**Dependency chain:** embedding-proxy → leemadb → orchestrator → pgbouncer + redis → app x3 → nginx

### Quick commands

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart orchestrator
docker compose -f docker-compose.prod.yml logs app --tail 50 -f
docker exec sanbao-orchestrator-1 curl -sf http://leemadb:8080/health
```

---

## Architecture

### Routing

- `src/app/(app)/` — 13 pages: `/chat`, `/chat/[id]`, `/profile`, `/settings`, `/skills`, `/agents`, `/billing`, `/mcp`, etc.
- `src/app/(auth)/` — `/login`, `/register`
- `src/app/(admin)/admin/` — 29 admin pages
- `src/app/(legal)/` — `/terms`, `/privacy`, `/offer`
- `src/app/api/` — **134 route files**

### Streaming Protocol

`POST /api/chat` → NDJSON `{t, v}`:
- `c` content, `r` reasoning, `p` plan, `s` status, `x` context, `e` error

Chat split across 7 files:
- `api/chat/route.ts` — orchestrator (auth, dispatch)
- `api/chat/validate.ts` — Zod validation
- `api/chat/agent-resolver.ts` — agent context, MCP tools, skills
- `api/chat/context-loader.ts` — conversation, context window, compaction
- `lib/chat/moonshot-stream.ts` — Kimi SSE + tool calling
- `lib/chat/ai-sdk-stream.ts` — OpenAI via Vercel AI SDK
- `lib/chat/message-builder.ts` — message formatting

### Custom Tags

`<sanbao-doc>`, `<sanbao-edit>`, `<sanbao-plan>`, `<sanbao-task>`, `<sanbao-clarify>` — parsed by client, defined in SYSTEM_PROMPT.

### AI Providers

- `src/lib/model-router.ts` → `resolveModel(category, planId?)`
- Categories: TEXT, IMAGE, VOICE, VIDEO, CODE, EMBEDDING
- Provider routing via `AiProvider.apiFormat`: `OPENAI_COMPAT` | `AI_SDK_OPENAI`

---

## Data Layer

### Prisma — 68 Models, 23 Enums

**Core:** User → Conversation → Message → Artifact, TokenLog, Attachment
**Agents:** Agent → AgentTool, AgentPlugin, AgentSkill, AgentMcpServer
**Tools:** Tool, Plugin → PluginTool, PluginSkill, PluginMcpServer, Skill → SkillTool
**MCP:** McpServer → UserMcpServer, McpToolLog
**Billing:** Plan → Subscription → DailyUsage, Payment, PromoCode, PlanModel
**AI:** AiProvider → AiModel
**Orgs:** Organization → OrgMember, OrgInvite, OrgAgent → OrgAgentFile/Member/Skill/McpServer
**Multi-agent:** MultiAgent → MultiAgentMember/File
**System:** AuditLog, ErrorLog, Notification, SystemSetting, Webhook, ApiKey, FileUpload

### State — 15 Zustand Stores

chatStore, artifactStore, articleStore, sourceStore, panelStore, sidebarStore, taskStore, agentStore, skillStore, memoryStore, billingStore, onboardingStore, orgStore, integrationStore + resetAllStores

### Redis & Caching

- `src/lib/redis.ts` — ioredis, graceful degradation (works without Redis in dev)
- Two-level agent cache: L1 in-memory (30s) + L2 Redis (60s)
- Rate limiting: Redis-first, in-memory fallback
- BullMQ queues: webhook, email

---

## Security

- **Auth:** NextAuth v5, JWT, Credentials + Google + Apple, 2FA TOTP
- **Mobile auth:** Apple (jose JWKS) + Google, Bearer token, 30-day expiry
- **Bearer-to-Cookie bridge:** `src/proxy.ts` for mobile API clients
- **Admin guard:** role + 2FA + IP whitelist
- **Rate-limit:** Redis + in-memory, auto-block (10 violations → 30min)
- **API keys:** AES-256-GCM encryption, per-key rate limit
- **SSRF:** `isUrlSafe()` blocks private IP ranges everywhere
- **CSP:** via next.config.ts
- **Input:** Zod validation, max 200 messages, 100KB/msg, 1MB stream buffer

---

## MCP Integration

4 agents from AI Cortex Orchestrator:

| Endpoint | Agent |
|----------|-------|
| `http://orchestrator:8120/lawyer` | Юрист (Legal KZ) |
| `http://orchestrator:8120/broker` | Брокер (Customs) |
| `http://orchestrator:8120/accountant` | Бухгалтер (1С) |
| `http://orchestrator:8120/consultant_1c` | 1С Консультант |

**Tool namespace dedup:** identical tool names auto-prefixed (`lawyer_search`, `accountant_search`).

**article:// protocol:** `article://criminal_code/188` → `/api/articles` → MCP → full text in panel.

### 14 Native Tools

system: get_current_time, get_user_info, get_conversation_context
http: http_request (SSRF-protected)
productivity: create_task, save_memory, send_notification, write/read_scratchpad
analysis: calculate, analyze_csv, generate_chart_data
content: read_knowledge, search_knowledge

Dispatch order: MCP tools → Native tools → `$web_search`

---

## Nginx (infra/nginx/nginx.conf)

- **LB:** `ip_hash` (sticky sessions for OAuth PKCE cookies)
- **Rate limits:** 30r/s general, 10r/s /api/chat (burst=5)
- **Body:** 600MB max
- **/api/chat:** 180s timeout, SSE (proxy_buffering off)
- **/images/1c/:** proxied to orchestrator:8120, 30d cache
- **Security:** HSTS 2yr, X-Frame-Options DENY, nosniff

---

## Infrastructure

### Cloudflare Tunnel (Server 2: 46.225.122.142)

| Domain | Target |
|--------|--------|
| sanbao.ai / www.sanbao.ai | localhost:3004 |
| mcp.leema.kz | localhost:8120 |
| leema.kz / www.leema.kz | localhost:5173 |

**Tunnel ID:** `222e9fb5-634f-4064-a1e9-8af13f47e4f1`

### Failover

- Monitor bot (`failover-monitor.service`): probes /api/ready every 30s
- 3 failures → start cloudflared → route traffic to Server 2
- 3 successes + 5min cooldown → stop

### Monitoring

- `/api/health` — full liveness (DB, Redis, AI, MCP)
- `/api/ready` — lightweight readiness (DB + Redis)
- `/api/metrics` — Prometheus-compatible
- Grafana + Prometheus: `infra/monitoring/`
- Sentry: active when `SENTRY_DSN` set

### K8s (optional)

Manifests in `infra/k8s/`: deployment (3-20 HPA), PDB, ingress, network policies, backup CronJob, Argo canary rollout.

---

## Key Patterns

- **Admin routes:** `const result = await requireAdmin(); if (result.error) return result.error;`
- **Admin CRUD factory:** `createAdminCrudHandlers({ model, allowedUpdateFields })`
- **Async params (Next.js 16):** `{ params }: { params: Promise<{ id: string }> }`
- **Fire-and-forget:** `fireAndForget(promise, context)`
- **Graceful degradation:** Redis/BullMQ return null when unavailable
- **SystemSetting:** key-value config table with cache invalidation
- **Path alias:** `@/*` → `./src/*`

---

## Frontend

**115 components** in 17 dirs: admin, agents, artifacts, billing, chat, image-edit, layout, legal-tools, memory, onboarding, panel, providers, settings, sidebar, skills, tasks, ui

**8 hooks:** useIsMobile, useTranslation, useAdminList, useAdminCrud, useCopyToClipboard, useInfiniteScroll, usePrintArtifact, useArtifactExport

### Style Guide — Soft Corporate Minimalism

- Backgrounds: never pure white/black, slight blue tint
- Border radius: 12px buttons, 16px cards, 32px chat input
- Spring animations: Framer Motion (damping 25, stiffness 300)
- UI text: Russian primary, Kazakh secondary

---

## Constants

All in `src/lib/constants.ts`:
- `DEFAULT_MAX_TOKENS=131072`, `DEFAULT_TIMEZONE="Asia/Almaty"`
- `NATIVE_TOOL_MAX_TURNS=50`, `BCRYPT_SALT_ROUNDS=12`
- Agent IDs: `LAWYER_ID`, `LAWYER_AGENT_ID`, `BROKER_AGENT_ID`, `SANBAO_AGENT_ID`

---

## Agents & Skills

### Specialized Agents

Use these agents for language-specific tasks:

| Agent | When to use |
|-------|-------------|
| **senior-fullstack-architect** | TypeScript/React: components, API routes, UI/UX, Next.js, performance optimization |
| **senior-python-architect** | Python: microservices, FastAPI, async patterns, testing, data pipelines |
| **rust-senior-architect** | Rust: axum services, CLI tools, async Rust, performance, safety |

**Always delegate** complex implementation tasks to the appropriate agent — they have deeper expertise and produce higher quality code.

### Skills (`.claude/skills/`)

Skills are loaded automatically when relevant. Available skills:

**TypeScript/Frontend:**
- `ai-chat-platform` — Universal AI chat architecture: provider abstraction (Vercel AI SDK), NDJSON streaming, artifacts panel, model router
- `claude-api` — Claude API + Agent SDK (TypeScript + Python)
- `frontend-design` — Production UI design without "AI slop"
- `web-artifacts-builder` — React + Tailwind + shadcn/ui artifacts
- `mcp-builder` — MCP server development (TypeScript + Python)

**Python:**
- `python-pro` — Modern Python 3.11+: mypy strict, async-first, Pydantic v2, Protocol DI
- `python-testing` — pytest infrastructure: real DB fixtures, factories, parametrize, 90%+ coverage
- `python-fastapi` — FastAPI production: lifespan, SSE streaming, WebSocket, Annotated DI

**Rust:**
- `rust-coding` — Idiomatic Rust: ownership, traits, error handling, build optimization
- `rust-axum-service` — Production axum: SQLx, tower middleware, graceful shutdown, tracing
- `rust-cli` — CLI tools: clap, indicatif, dialoguer, TOML config

**Meta:**
- `skill-creator` — Create, test, and optimize skills with evals
- `webapp-testing` — Playwright web app testing

### Usage Pattern

For this project (sanbao = Next.js + TypeScript), prefer:
1. `senior-fullstack-architect` agent for all TypeScript/React work
2. `ai-chat-platform` skill when working on chat UI, streaming, or provider abstraction
3. `python-pro` + `python-fastapi` skills when working on orchestrator Python code
4. `rust-coding` + `rust-axum-service` skills when working on ai_cortex Rust code
