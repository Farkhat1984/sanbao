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

- `src/app/(app)/` — основное приложение (требует авторизации): `/chat`, `/chat/[id]`, `/profile`, `/settings`
- `src/app/(auth)/` — аутентификация: `/login`, `/register`
- `src/app/api/` — API-роуты: `/chat` (AI стриминг), `/conversations` CRUD, `/auth` (NextAuth + register)

### State Management

Zustand-сторы (`src/stores/`):
- **chatStore** — activeConversationId, messages, conversations, streaming-флаги, activeToolName
- **sidebarStore** — isOpen, isCollapsed, searchQuery
- **artifactStore** — activeArtifact, activeTab (preview/edit/source), версионирование

### Data Layer

- **Prisma + PostgreSQL** — схема в `prisma/schema.prisma`
- Модели: User, Conversation, Message, Artifact, LegalReference, Attachment
- Enums: UserRole (USER/PRO/ADMIN), MessageRole, ArtifactType (CONTRACT/CLAIM/COMPLAINT/DOCUMENT/CODE/ANALYSIS)
- Auth: NextAuth v5 с JWT-стратегией, провайдеры: Credentials, Google, GitHub

### AI Integration

- Vercel AI SDK (`streamText`) — `src/app/api/chat/route.ts`
- Провайдеры: OpenAI (gpt-4o), Anthropic (claude-sonnet-4-5)
- Системный промпт задаёт роль юридического ассистента

### Key Libraries

- **Tiptap** — редактор документов в ArtifactPanel
- **Framer Motion** — анимации (spring: damping 25, stiffness 300)
- **react-markdown + remark-gfm + rehype-highlight** — рендер markdown в сообщениях
- **Lucide React** — иконки (16-18px)
- **next-themes** — светлая/тёмная тема (class-based)
- **tailwind-merge + clsx** — утилита `cn()` в `src/lib/utils.ts`

### Component Structure

- `components/layout/` — AppShell (3-колоночный layout), Header
- `components/chat/` — ChatArea, MessageBubble, MessageInput, LegalReference, ThinkingIndicator, WelcomeScreen
- `components/sidebar/` — Sidebar, ConversationList, ConversationItem
- `components/artifacts/` — ArtifactPanel (480px), DocumentEditor, DocumentPreview
- `components/legal-tools/` — ToolsPanel (6 юр. инструментов)
- `components/ui/` — Button (primary/secondary/ghost/danger/gradient), Avatar, Badge, Tooltip, Modal, Skeleton

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
