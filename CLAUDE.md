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

**Leema** — юридический AI-ассистент для работы с НПА (Next.js 16 App Router, TypeScript).

### Routing

- `src/app/(app)/` — основное приложение (требует авторизации): `/chat`, `/chat/[id]`, `/profile`, `/settings`, `/skills`, `/billing`, `/mcp`
- `src/app/(auth)/` — аутентификация: `/login`, `/register`
- `src/app/api/` — API-роуты: `/chat`, `/conversations`, `/agents`, `/skills`, `/tasks`, `/memory`, `/billing`, `/admin`, `/auth`

### State Management

Zustand-сторы (`src/stores/`):
- **chatStore** — messages, conversations, streaming-флаги, provider, thinkingEnabled, webSearchEnabled, clarifyQuestions, pendingInput, contextUsage
- **artifactStore** — activeArtifact, activeTab (preview/edit/source), версионирование, applyEdits()
- **sidebarStore** — isOpen, isCollapsed, searchQuery
- **taskStore** — tasks[], toggleStep(), updateTask()
- **agentStore** — agents[], activeAgentId
- **skillStore** — skills[], activeSkill
- **memoryStore** — memories (user memory across sessions)
- **billingStore** — currentPlan, usage, subscription
- **onboardingStore** — hasCompletedTour, isVisible

### Custom Tag System

AI ответы содержат специальные `leema-*` теги, которые парсятся клиентом:

| Тег | Назначение | Парсится в |
|-----|-----------|------------|
| `<leema-doc type="" title="">` | Создание документа/артефакта | MessageBubble.tsx → artifactStore |
| `<leema-edit target="">` | Точечные правки существующего документа | MessageBubble.tsx → applyEdits() |
| `<leema-plan>` | Блок планирования (стримится отдельно) | route.ts (streaming) → chatStore.currentPlan |
| `<leema-task title="">` | Чек-лист задач (3+ шагов) | MessageInput.tsx → POST /api/tasks |
| `<leema-clarify>` | JSON-вопросы перед созданием документа | MessageInput.tsx → ClarifyModal |

Теги определены в системном промпте (`route.ts` → `SYSTEM_PROMPT`). При добавлении нового тега: определить regex, добавить парсинг в MessageInput/MessageBubble, скрыть raw-тег из рендера.

### Streaming Protocol

`POST /api/chat` отдаёт NDJSON-стрим. Каждая строка — `{t, v}`:
- `r` — reasoning (thinking mode)
- `c` — content (основной текст)
- `p` — plan content (внутри `<leema-plan>`)
- `s` — search status (веб-поиск)
- `x` — context info (usage%, compacting)
- `e` — error

Парсинг стрима: `MessageInput.tsx` → `doSubmit()`. План-детекция на сервере: `route.ts` → `streamMoonshot()` / `createPlanDetectorStream()`.

### AI Providers

- **Moonshot (Kimi K2.5)** — основной провайдер (`deepinfra`), ручной SSE-стриминг, поддержка web search через `$web_search` builtin tool
- **OpenAI (gpt-4o)** / **Anthropic (claude-sonnet-4-5)** — через Vercel AI SDK `streamText`
- Системные агенты: только Фемида (`FEMIDA_ID` в `src/lib/system-agents.ts`), кастомные агенты хранятся в БД

### Context Management

`src/lib/context.ts` — управление контекстным окном:
- `estimateTokens()` — оценка токенов (chars / 3.5)
- `checkContextWindow()` — проверка заполненности контекста
- `splitMessagesForCompaction()` — разделение на старые (сжимаются) и новые (остаются)
- Компактинг: фоновый запрос к Moonshot → `ConversationSummary` в БД
- `buildSystemPromptWithContext()` — собирает systemPrompt + summary + planMemory + userMemory

### Data Layer

- **Prisma + PostgreSQL** — схема в `prisma/schema.prisma`
- Ключевые модели: User, Conversation, Message, Artifact, Agent, AgentFile, Skill, Task, Plan, Subscription, DailyUsage, UserMemory, ConversationSummary, ConversationPlan
- Enums: UserRole (USER/PRO/ADMIN), MessageRole, ArtifactType (CONTRACT/CLAIM/COMPLAINT/DOCUMENT/CODE/ANALYSIS)
- Auth: NextAuth v5 с JWT-стратегией, провайдеры: Credentials, Google, GitHub
- Биллинг: Plan → Subscription → DailyUsage, гранулярные лимиты (messages/day, tokens/month, requestsPerMinute, feature flags)

### Key Libraries

- **Tiptap** — редактор документов в ArtifactPanel
- **Framer Motion** — анимации (spring: damping 25, stiffness 300)
- **react-markdown + remark-gfm + rehype-highlight** — рендер markdown в сообщениях
- **Lucide React** — иконки (16-18px)
- **next-themes** — светлая/тёмная тема (class-based)
- **tailwind-merge + clsx** — утилита `cn()` в `src/lib/utils.ts`
- **docx / html2pdf.js** — экспорт документов
- **mammoth / pdf-parse / xlsx** — парсинг загруженных файлов

### Path Alias

`@/*` maps to `./src/*` (tsconfig paths).

## Style Guide

Дизайн-система **Soft Corporate Minimalism** — подробности в `STYLEGUIDE.md`. Ключевые правила:
- Фон никогда чисто белый/чёрный — всегда с голубым оттенком
- Бордеры вместо теней для разделения; тени только для "парящих" элементов
- Градиент accent->legal-ref только для 1-2 главных CTA
- Все интерактивные элементы: hover-состояние + cursor-pointer
- Скругления: кнопки 12px, карточки 16px, чат-инпут 32px, аватары full

## Localization

Весь UI на русском языке. Даты форматируются через `formatDate()` в `src/lib/utils.ts` (Сегодня, Вчера, X дн. назад).
