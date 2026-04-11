# sanbao/ — CLAUDE.md

B2B SaaS AI-assistant for legal, customs, accounting professionals in Kazakhstan.

**Tech:** Next.js 16.1 + React 19 + TypeScript + Tailwind CSS 4 + PostgreSQL 16 + Redis 7

**MCP Integration:** 4 AI agents from ai_cortex Orchestrator (Legal, Customs, Accounting, 1С)

---

## 📚 Documentation for sanbao/

- **`README.md`** ← Quick start, project structure, commands
- **`ARCHITECTURE.md`** ← Layer design, data flows, patterns
- **`CLAUDE.md`** ← This file: Implementation details & references

---

## Commands

```bash
# Development
npm run dev              # Dev server :3004
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Vitest

# Database
npx prisma migrate deploy   # Apply migrations
npx prisma generate        # Regenerate Prisma client
npx prisma db seed         # Seed (plans, agents, tools, models, skills)
npx prisma studio          # Visual DB browser (:5555)
```

### Local Env Setup

```bash
# Copy and fill in .env.example
cp .env.example .env
# Required: DATABASE_URL, REDIS_URL, AUTH_SECRET, ENCRYPTION_KEY
# Optional: SENTRY_DSN, LLM API keys
npm install
npm run dev
```

### Dev Docker (Local Integration Testing)

```bash
# docker-compose.yml runs PostgreSQL + Redis only (for local dev with cloud services)
docker compose up -d
npm run dev

# Or full stack for testing production setup
# See scripts/deploy.sh and docker-compose.prod.yml (managed from sanbao root)
```

---

## Architecture

### File Structure

```
src/
├── app/
│   ├── (app)/               # User pages (13 routes)
│   │   ├── chat/            # /chat, /chat/[id]
│   │   ├── agents/          # /agents, /agents/[id]
│   │   ├── skills/          # /skills, /skills/[id]
│   │   ├── profile/
│   │   ├── settings/
│   │   ├── billing/
│   │   └── mcp/             # MCP server management
│   ├── (auth)/              # Auth pages (/login, /register)
│   ├── (admin)/admin/       # Admin panel (29 routes)
│   │   ├── users/
│   │   ├── models/
│   │   ├── tools/
│   │   ├── skills/
│   │   ├── agents/
│   │   ├── organizations/
│   │   └── ...
│   ├── (legal)/             # Legal pages (/terms, /privacy, /offer)
│   ├── api/                 # **134 route files**
│   │   ├── auth/            # NextAuth endpoints
│   │   ├── chat/            # Main chat streaming endpoint
│   │   ├── agents/          # Agent CRUD + knowledge base
│   │   ├── skills/          # Skill management
│   │   ├── tools/           # Tool CRUD
│   │   ├── mcp/             # MCP server endpoints
│   │   ├── billing/         # Stripe/Freedom Pay integration
│   │   ├── admin/           # Admin API (~50 routes)
│   │   └── ...
│   ├── layout.tsx           # Root layout
│   └── not-found.tsx        # 404 page
│
├── components/              # **115 UI components** (17 dirs)
│   ├── ui/                  # shadcn/ui primitives
│   ├── admin/               # Admin-specific components
│   ├── agents/              # Agent management UI
│   ├── chat/                # Chat interface
│   ├── artifacts/           # Artifact display/editor
│   ├── billing/             # Billing components
│   ├── memory/              # Memory management
│   ├── skills/              # Skill builder
│   ├── tasks/               # Task management
│   └── ...
│
├── lib/
│   ├── ai-cortex-client.ts  # Orchestrator API client (MCP, Pipeline)
│   ├── model-router.ts      # AI provider selection (Kimi, OpenAI, Claude, DeepInfra)
│   ├── redis.ts             # Redis client + graceful degradation
│   ├── constants.ts         # App-wide constants
│   ├── db.ts                # Prisma client
│   ├── auth.ts              # NextAuth configuration
│   ├── middleware.ts        # Request middleware (auth, rate limit)
│   ├── utils/               # Utility functions
│   └── hooks.ts             # Custom React hooks
│
├── middleware.ts            # Next.js edge middleware (auth, locale)
├── stores/                  # **15 Zustand stores** (packages/stores)
│   ├── chat-store.ts        # Chat state
│   ├── artifact-store.ts    # Artifact display
│   ├── agent-store.ts       # Agent selector
│   ├── skill-store.ts       # Skill management
│   ├── memory-store.ts      # Memory (external brain)
│   ├── task-store.ts        # Task list
│   ├── billing-store.ts     # Subscription state
│   ├── org-store.ts         # Organization context
│   └── ...
│
├── styles/
│   ├── globals.css          # Global styles, Tailwind directives
│   └── animations.ts        # Framer Motion presets
│
└── .env.example
```

### Routing Structure

**Public routes:**
- `/login`, `/register`
- `/terms`, `/privacy`, `/offer`

**Authenticated routes (user):**
- `/chat` — Main chat interface
- `/agents`, `/agents/[id]` — Agent management
- `/skills`, `/skills/[id]` — Skill builder
- `/profile`, `/settings` — User settings
- `/billing` — Subscription & payments
- `/mcp` — MCP server management

**Admin routes (role-based, 2FA required):**
- `/admin/users`, `/admin/models`, `/admin/tools`, `/admin/skills`
- `/admin/agents`, `/admin/organizations`
- `/admin/billing`, `/admin/audit-log`, `/admin/experiments`

### Chat Streaming

Main endpoint: `POST /api/chat`

**Response format:** NDJSON, each line is `{t, v}`:
```
t = message type: "c" (content) | "r" (reasoning) | "p" (plan) | "s" (status) | "x" (context) | "e" (error)
v = value: string
```

**Architecture:** Split across 7 files:
1. `api/chat/route.ts` — orchestrator (auth, dispatch to LLM)
2. `api/chat/validate.ts` — Zod request/response validation
3. `api/chat/agent-resolver.ts` — resolve agent context, MCP tools, skills
4. `api/chat/context-loader.ts` — load conversation history, compact context window
5. `lib/chat/moonshot-stream.ts` — Kimi K2.5 SSE streaming + tool calling
6. `lib/chat/ai-sdk-stream.ts` — OpenAI/Claude via Vercel AI SDK
7. `lib/chat/message-builder.ts` — message formatting, tool injection

### Custom Message Tags

Parsed by client, used for UI rendering:
- `<sanbao-doc>` — document artifact
- `<sanbao-edit>` — editable artifact  
- `<sanbao-plan>` — multi-step plan
- `<sanbao-task>` — task creation
- `<sanbao-clarify>` — clarification needed

All defined in `SYSTEM_PROMPT` (injected into every request).

---

## Data Layer

### Prisma Schema — 68 Models, 23 Enums

**Core Models:**
- `User` → `Conversation` → `Message` → `Artifact`
- `TokenLog` (usage tracking), `Attachment` (file uploads)

**Agent/Tool/Skill:**
- `Agent` + `AgentTool`, `AgentPlugin`, `AgentSkill`, `AgentMcpServer`
- `Tool`, `Plugin` + `PluginTool`, `PluginSkill`, `PluginMcpServer`
- `Skill` + `SkillTool`

**MCP Integration:**
- `McpServer` — registered MCP servers (endpoint, domain, status)
- `UserMcpServer` — per-user server access
- `McpToolLog` — usage analytics

**Billing:**
- `Plan` (pricing tier) → `Subscription` (user plan)
- `DailyUsage` (tokens per day), `Payment` (Stripe/Freedom)
- `PromoCode` (discounts), `PlanModel` (which models per plan)

**AI:**
- `AiProvider` (Kimi, OpenAI, Claude, DeepInfra)
- `AiModel` (model definitions, costs)

**Organizations:**
- `Organization` + `OrgMember` + `OrgInvite`
- `OrgAgent` + `OrgAgentFile`, `OrgAgentMember`, `OrgAgentSkill`, `OrgAgentMcpServer`

**Multi-Agent:**
- `MultiAgent` (team of agents) + `MultiAgentFile`, `MultiAgentMember`

**System:**
- `AuditLog`, `ErrorLog`, `Notification`
- `SystemSetting` (K-V config), `Webhook`, `ApiKey`, `FileUpload`

**Enums (23):** ChatRoleType, ArtifactType, PlanType, SkillStatus, TaskStatus, etc.

### State Management

**Zustand Stores** (15 total, in `packages/stores/`):
- `chatStore` — current conversation
- `artifactStore` — artifact viewing/editing
- `agentStore` — selected agent
- `skillStore` — skill builder state
- `taskStore` — task list
- `memoryStore` — user memory (external brain)
- `billingStore` — subscription state
- `orgStore` — organization context
- `onboardingStore`, `panelStore`, `sidebarStore`, `articleStore`, `sourceStore`, `integrationStore`
- `resetAllStores` — reset all on logout

All persist to localStorage where needed. No Redux.

### Redis & Caching

**Client:** `src/lib/redis.ts` (ioredis)
- Graceful degradation: works without Redis in dev
- Two-level agent cache: L1 in-memory (30s) + L2 Redis (60s)
- Rate limiting: Redis-first, in-memory fallback
- BullMQ queues: `webhook` (5 workers), `email` (2 workers)

**Keys:** Prefixed with app version + namespace to prevent cache collisions.

---

## AI Integration

### Model Router

`src/lib/model-router.ts` → `resolveModel(category, planId?)`

**Categories:**
- `TEXT` — chat, summarization (default: Kimi K2.5)
- `IMAGE` — image generation, analysis (OpenAI DALL-E, Claude Opus)
- `VOICE` — audio transcription, TTS (OpenAI Whisper, TTS)
- `VIDEO` — video analysis (Claude Opus)
- `CODE` — code generation (DeepInfra)
- `EMBEDDING` — vector embeddings (DeepInfra Qwen3-Embedding-8B)

**Routing:**
- Provider selection by category + user plan + availability
- Fallback chain: primary → secondary → error
- Token count + cost tracking via `TokenLog`

### LLM Providers

| Provider | Models | Integration |
|----------|--------|-------------|
| **Moonshot (Kimi)** | k2.5 (default TEXT) | REST API |
| **OpenAI** | GPT-4o, o1, DALL-E, Whisper | Vercel AI SDK |
| **Anthropic (Claude)** | Claude Opus 4.6, Sonnet 4.6 | Vercel AI SDK |
| **DeepInfra** | Meta Llama, Qwen (embedding) | OpenAI-compatible API |

---

## Security

- **Auth:** NextAuth v5, JWT (30-day mobile expiry), Credentials + Google + Apple OAuth
- **2FA:** TOTP (time-based one-time password) for admin + sensitive ops
- **Mobile:** Bearer token via `Authorization: Bearer <token>` header
- **Token storage:** Bearer tokens in mobile secure storage, JWT in HTTP-only cookies for web
- **Admin guard:** `requireAdmin()` utility checks role + 2FA + optional IP whitelist
- **Rate limiting:** Redis + in-memory fallback, auto-block 10 violations → 30min ban
- **API keys:** AES-256-GCM encryption (ENCRYPTION_KEY env var), per-key rate limits
- **SSRF protection:** `isUrlSafe()` blocks private IP ranges (10.*, 172.16-31.*, 192.168.*, 127.*)
- **Input validation:** Zod schemas, max 200 messages per conversation, 100KB per message, 1MB stream buffer
- **CSP:** Content Security Policy via `next.config.ts`

---

## MCP Integration — ai_cortex Orchestrator

**Orchestrator URL:** `http://orchestrator:8120` (inside Docker) or env var `AI_CORTEX_PUBLIC_URL`

### MCP Endpoints

Unified endpoint: `http://orchestrator:8120/mcp/{domain}`

| Domain | Agent | Purpose |
|--------|-------|---------|
| `legal_kz` | Юрист | Казахстанское законодательство |
| `laws_kz` | Юрист | Законы КЗ (расширенная база) |
| `accounting_1c` | Бухгалтер | 1С Бухгалтерия (конфиги) |
| `accounting_ref_kz` | Бухгалтер | Справочная база КЗ |
| `platform_1c` | 1С Консультант | 1С-Битрикс |
| `tnved` | Брокер (Customs) | ТНВЭД таможенные коды |
| Dynamic domains | Custom agents | User-created via knowledge base publish |

**Note:** Old env vars `LAWYER_MCP_URL`, `BROKER_MCP_URL`, etc. (in `.env.example`) are **stale**. MCP now uses unified `/mcp/{domain}` pattern. URLs stored in `McpServer` table in DB.

### MCP Client

`src/lib/ai-cortex-client.ts` exports:
```typescript
// Knowledge base pipeline
createNamespace(orgId, apiKey) → create isolated tenant in LeemaDB
createProject(data) → create document processing project
uploadFile(projectId, file) → upload to pipeline
processProject(projectId) → start 7-phase pipeline (SSE progress)
publishProject(projectId) → publish as MCP endpoint
getProjectProgress(projectId) → SSE stream of real-time updates

// Tool discovery
discoverMcpTools(domain) → fetch available tools from /mcp/{domain}
callMcpTool(domain, toolName, args) → execute tool (JSON-RPC 2.0)
```

All calls auto-inject `Authorization: Bearer <token>`.

### 14 Native Tools

**System:**
- `get_current_time()` — return current time/date/timezone
- `get_user_info()` — return authenticated user data
- `get_conversation_context()` — return conversation history (for LLM context)

**HTTP:**
- `http_request(method, url, headers, body)` — SSRF-protected external requests

**Productivity:**
- `create_task(title, description, dueDate)` — save task to DB
- `save_memory(key, value)` — save to user memory (external brain)
- `send_notification(type, message)` — push to user's notification center
- `write_scratchpad(content)`, `read_scratchpad()` — temp storage

**Analysis:**
- `calculate(expression)` — eval math expression (safe)
- `analyze_csv(csv_text, question)` — analyze data via LLM
- `generate_chart_data(data)` → return formatted for charting

**Content:**
- `read_knowledge(docId)` — fetch doc from knowledge base
- `search_knowledge(query)` — semantic search knowledge base

**Dispatch order:** MCP tools → Native tools → `$web_search` (if enabled)

---

## Monorepo Structure

### packages/

**`packages/shared`** (`@sanbao/shared`):
- Types, constants, validation schemas
- I18n setup, translation keys
- Utility functions, date/time helpers
- Form utilities, data parsing
- Animation presets (Spring, Fade, Slide)

**`packages/stores`** (`@sanbao/stores`):
- 15 Zustand stores (chat, artifact, agent, skill, etc.)
- React context + hooks
- Persistence layer (localStorage, IndexedDB)

**`packages/ui`** (`@sanbao/ui`):
- Reusable React components
- shadcn/ui re-exports
- Theme variables + utilities
- Component stories (Storybook optional)

### apps/

**`apps/mobile`** (Capacitor, iOS + Android):
- WebView wraps web app (same Next.js instance)
- Native plugin: biometrics, notifications, camera
- App ID: `com.sanbao.sanbaoai`
- Server: `https://www.sanbao.ai`
- Bearer token auth (no cookies)

**`apps/web`** (optional, may be unused):
- Extra web app or landing page

---

## Frontend Patterns

### Components (115 total)

**Patterns:**
- Atomic design: primitives → components → features
- shadcn/ui + Tailwind CSS 4
- Custom hooks for data fetching (TanStack Query via stores)
- Props validation with TypeScript (no PropTypes)
- Compound components for complex UI

**8 Custom Hooks:**
- `useIsMobile()` — device detection
- `useTranslation()` — i18n
- `useAdminList(model)` — admin CRUD query
- `useAdminCrud(model)` — admin CRUD mutations
- `useCopyToClipboard()` — clipboard action
- `useInfiniteScroll()` — infinite pagination
- `usePrintArtifact()` — export artifact to PDF
- `useArtifactExport()` — export to various formats

### Style Guide — Soft Corporate Minimalism

- **Color:** Never pure white/black, slight blue tint (HSL variables)
- **Spacing:** Consistent scale (4px unit)
- **Border radius:** 12px buttons, 16px cards, 32px chat input
- **Animations:** Framer Motion springs (damping 25, stiffness 300), no rigid easing
- **Typography:** Russian primary, Kazakh secondary, clear hierarchy
- **Dark theme:** No light mode, always dark

### Animations

Framer Motion presets in `src/styles/animations.ts`:
```typescript
fadeIn, slideInUp, scaleIn, staggerContainer
```

Used in: page transitions, modal opens, message reveals, artifact changes.

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sanbao

# Auth
AUTH_SECRET=<base64-encoded random>
ENCRYPTION_KEY=<base64-encoded AES-256 key>

# Redis (optional, defaults to in-memory)
REDIS_URL=redis://localhost:6379/0
```

### Optional

```bash
# AI Cortex integration
AI_CORTEX_URL=http://orchestrator:8120
AI_CORTEX_PUBLIC_URL=https://leema.kz

# LLM API keys (if not using defaults)
MOONSHOT_API_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
DEEPINFRA_API_KEY=sk-...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...

# Payment
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FREEDOM_MERCHANT_ID=...

# Monitoring
SENTRY_DSN=https://...
GRAFANA_CLOUD_TOKEN=...

# Feature flags
NEXT_PUBLIC_ENABLE_1C_FORMS=true
NEXT_PUBLIC_ENABLE_OCR=false
```

---

## Testing

```bash
# Vitest (frontend + API routes)
npm test                        # Run all tests
npm test -- --watch            # Watch mode
npm test -- --coverage         # Coverage report

# E2E (optional, not configured)
# npx playwright test
```

---

## Common Tasks

### Add a new chat-compatible skill

1. Create handler in `orchestrator/handlers/` (ai_cortex side)
2. Register in `HandlerRegistry`
3. Create Skill record in sanbao DB
4. Add to Agent's skills (AgentSkill join)
5. Import in `agent-resolver.ts`

### Add a new API endpoint

1. Create route in `src/app/api/...`
2. Add auth guard if needed: `requireAdmin()`, `getSession()`
3. Use Prisma for DB: `import { db } from '@/lib/db'`
4. Return JSON or error (NextResponse)
5. Test with curl or API client

### Update Prisma schema

1. Edit `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name <name>`
3. Regenerate client: `npx prisma generate` (auto on migrate)
4. Commit migration file to git

### Deploy to production

```bash
cd sanbao
./scripts/deploy.sh app     # Rolling restart (fastest)
./scripts/deploy.sh full    # Full rebuild
./scripts/deploy.sh status  # Check containers
./scripts/deploy.sh logs app --tail 50 -f
```

See **main `/SANBAO_PROJECT/CLAUDE.md`** for production Docker, Nginx, Cloudflare, failover details.

---

## References

- **Infrastructure/Deployment:** `/SANBAO_PROJECT/CLAUDE.md` (Docker, ports, nginx, Cloudflare, failover)
- **ai_cortex/LeemaDB:** `ai_cortex/CLAUDE.md` (Rust, Orchestrator overview)
- **Orchestrator:** `ai_cortex/orchestrator/CLAUDE.md` (MCP, Pipeline, Handlers)
- **Web Admin:** `ai_cortex/web/CLAUDE.md` (React SPA, leema.kz)
- **NextAuth:** Next.js Auth documentation
- **Vercel AI SDK:** SDK documentation for streaming, model routing
- **Prisma:** ORM documentation + best practices
