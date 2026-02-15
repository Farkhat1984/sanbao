# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint (next core-web-vitals + typescript)
npx prisma db push   # Sync schema to DB (no migrations)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Visual DB browser
```

## Architecture

**Sanbao** — универсальный AI-ассистент (Next.js 16 App Router, TypeScript, PostgreSQL).

### Routing

- `src/app/(app)/` — основное приложение: `/chat`, `/chat/[id]`, `/profile`, `/settings`, `/skills`, `/billing`, `/mcp`
- `src/app/(auth)/` — аутентификация: `/login`, `/register`
- `src/app/(admin)/admin/` — админ-панель (25+ страниц): обзор, users, plans, billing, promo-codes, sessions, providers, models, agents, skills, mcp, analytics, usage, logs, errors, health, moderation, agent-moderation, experiments, email, notifications, settings, templates, api-keys, webhooks, files
- `src/app/api/` — API-роуты: chat, conversations, agents, skills, tasks, memory, billing (checkout, webhook, apply-promo, current, plans), admin/*, auth (2fa), health, metrics, notifications, reports

### State Management

Zustand-сторы (`src/stores/`): chatStore, artifactStore, sidebarStore, taskStore, agentStore, skillStore, memoryStore, billingStore, onboardingStore.

### Custom Tag System

AI-ответы содержат `sanbao-*` теги, парсятся клиентом:
- `<sanbao-doc type="" title="">` — создание артефакта
- `<sanbao-edit target="">` — правки документа
- `<sanbao-plan>` — блок планирования
- `<sanbao-task title="">` — чек-лист задач
- `<sanbao-clarify>` — JSON-вопросы перед созданием документа

Теги определены в `SYSTEM_PROMPT` (route.ts). При добавлении нового: regex → парсинг в MessageInput/MessageBubble → скрыть raw-тег.

### Streaming Protocol

`POST /api/chat` → NDJSON `{t, v}`: `r` reasoning, `c` content, `p` plan, `s` search status, `x` context info, `e` error.

### AI Providers & Model Router

- `src/lib/model-router.ts` → `resolveModel(category, planId?)` — динамический выбор модели из БД
- Приоритет: план-дефолт → план-модель → глобальный дефолт → env-fallback
- Категории: TEXT, IMAGE, VOICE, VIDEO, CODE, EMBEDDING
- Moonshot — ручной SSE, web search через `$web_search`; OpenAI/Anthropic — через Vercel AI SDK
- `PlanModel` — связь план↔модель; A/B эксперименты через `src/lib/ab-experiment.ts`

### Context Management

`src/lib/context.ts`: estimateTokens(), checkContextWindow(), splitMessagesForCompaction(). Компактинг → ConversationSummary в БД. buildSystemPromptWithContext() — systemPrompt + summary + planMemory + userMemory.

### Security

- Auth: NextAuth v5, JWT, Credentials + Google OAuth, 2FA TOTP (`otplib` OTP class)
- Admin guard: `src/lib/admin.ts` → `requireAdmin()` — role + 2FA + IP whitelist check
- Proxy: `src/proxy.ts` (Edge Runtime) — admin IP whitelist, maintenance mode
- Rate-limit: `src/lib/rate-limit.ts` — per-user, auto-block при abuse (10 нарушений за 5 мин → блок 30 мин)
- API keys: `src/lib/crypto.ts` AES-256-GCM; `src/lib/api-key-auth.ts` — per-key rate limit
- Content filter: `src/lib/content-filter.ts` — SystemSetting-based с кэшем

### Data Layer

- **Prisma + PostgreSQL** — `prisma/schema.prisma`, ~44 модели, 13 enum'ов
- Ключевые модели: User, Conversation, Message, Artifact, Agent, AgentFile, Skill, Task, Plan, Subscription, DailyUsage, UserMemory, AiProvider, AiModel, PlanModel, SystemAgent, SystemSetting, ApiKey, Webhook, WebhookLog, TokenLog, AuditLog, ErrorLog, EmailLog, EmailTemplate, Notification, DocumentTemplate, PromoCode, Payment, PromptExperiment, PromptVersion, ContentReport, FileUpload, McpServer, McpToolLog
- Audit: `src/lib/audit.ts` — logAudit(), logError(), logTokenUsage()
- Billing: Plan → Subscription (trialEndsAt) → DailyUsage; Plan.maxStorageMb для квоты файлов
- Email: `src/lib/email.ts` (Nodemailer), `src/lib/invoice.ts`, шаблоны с переменными `{{varName}}`
- Webhooks: `src/lib/webhook-dispatcher.ts` — dispatch + retry + WebhookLog

### Key Patterns

- Admin API: `const result = await requireAdmin(); if (result.error) return result.error;`
- Async params (Next.js 16): `{ params }: { params: Promise<{ id: string }> }`
- Fire-and-forget: `.catch((err) => console.error(...))` для email/webhook
- In-memory cache с TTL: content-filter, IP whitelist, model resolution, A/B experiments
- SystemSetting key-value: глобальный конфиг с cache invalidation

### Key Libraries

- **otplib** (v13) — OTP class: generateSecret(), verify({token, secret}), generateURI({issuer, label, secret})
- **stripe** — Checkout Session, webhook constructEvent
- **@aws-sdk/client-s3** — S3/MinIO upload/delete/presigned URL (`src/lib/storage.ts`)
- **Tiptap** — редактор; **Framer Motion** — анимации; **Lucide React** — иконки
- **react-markdown + remark-gfm + rehype-highlight** — markdown рендер
- **docx / html2pdf.js** — экспорт; **mammoth / pdf-parse / xlsx** — парсинг файлов

### Path Alias

`@/*` → `./src/*` (tsconfig paths).

## Style Guide

Дизайн-система **Soft Corporate Minimalism** — подробности в `STYLEGUIDE.md`. Весь UI на русском языке.

## Localization

Даты: `formatDate()` в `src/lib/utils.ts` (Сегодня, Вчера, X дн. назад).
