# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (port from env or 3000)
npm run build        # Production build (standalone output)
npm run start        # Start production server
npm run lint         # ESLint (next core-web-vitals + typescript)
npx prisma db push   # Sync schema to DB (no migrations)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db seed   # Seed plans, admin user, system agent, default models/skills
npx prisma studio    # Visual DB browser
```

Docker: `docker compose up --build` — runs PostgreSQL 16 + app on port 3004.

## Architecture

**Sanbao** — универсальный AI-ассистент (Next.js 16 App Router, React 19 with React Compiler, TypeScript, Tailwind CSS v4, PostgreSQL).

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

Zustand stores in `src/stores/`: chatStore, artifactStore, sidebarStore, taskStore, agentStore, skillStore, memoryStore, billingStore, onboardingStore.

### Security

- **Auth:** NextAuth v5, JWT, Credentials + Google OAuth, 2FA TOTP (`otplib` OTP class)
- **Middleware:** `src/proxy.ts` (Edge Runtime) — auth wrapper, admin IP whitelist, maintenance mode, suspicious path blocking
- **Admin guard:** `src/lib/admin.ts` → `requireAdmin()` — role + 2FA + IP whitelist
- **Rate-limit:** `src/lib/rate-limit.ts` — per-user, auto-block on abuse (10 violations in 5 min → 30 min block)
- **API keys:** `src/lib/crypto.ts` AES-256-GCM; `src/lib/api-key-auth.ts` — per-key rate limit
- **Content filter:** `src/lib/content-filter.ts` — SystemSetting-based with in-memory cache

### Data Layer

- **Prisma + PostgreSQL** — `prisma/schema.prisma`, ~52 models, 14 enums
- Seed script (`prisma/seed.ts`): creates Free/Pro/Business plans, admin user, Femida+Sanbao system agents, 11 tools with templates, Moonshot/DeepInfra providers, default AI models, 4 built-in skills
- **Audit:** `src/lib/audit.ts` — `logAudit()`, `logError()`, `logTokenUsage()`
- **Billing:** Plan → Subscription (trialEndsAt) → DailyUsage; `Plan.maxStorageMb` for file quota
- **Email:** `src/lib/email.ts` (Nodemailer), templates with `{{varName}}` interpolation
- **Webhooks:** `src/lib/webhook-dispatcher.ts` — dispatch + retry + WebhookLog

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

### Key Patterns

- **Admin API routes:** `const result = await requireAdmin(); if (result.error) return result.error;`
- **Async params (Next.js 16):** `{ params }: { params: Promise<{ id: string }> }`
- **Fire-and-forget:** `.catch((err) => console.error(...))` for email/webhook side-effects
- **In-memory cache with TTL:** content-filter, IP whitelist, model resolution, A/B experiments
- **SystemSetting key-value:** global config table with cache invalidation
- **serverExternalPackages** in `next.config.ts`: native/Node packages that can't be bundled (canvas, otplib, bcryptjs, stripe, S3, nodemailer, pdf-parse, xlsx, mammoth)

### Key Libraries

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

Design system **Soft Corporate Minimalism** — details in `STYLEGUIDE.md`. Key rules:
- Backgrounds never pure white/black — always with a slight blue tint
- Color tokens via CSS variables (`--bg`, `--accent`, `--text-primary`, etc.)
- Border radius: 12px buttons, 16px cards/modals, 32px chat input
- Spring-based animations (Framer Motion): damping 25, stiffness 300
- Gradients only for 1–2 CTAs per screen

All UI text is in Russian.

## Localization

Dates: `formatDate()` in `src/lib/utils.ts` (Сегодня, Вчера, X дн. назад).
