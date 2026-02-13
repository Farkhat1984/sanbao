# Leema — Юридический AI-ассистент

AI-платформа для работы с нормативно-правовыми актами. Собственный движок понимает связи между статьями, проверяет актуальность и помогает создавать юридические документы.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — дизайн-система Soft Corporate Minimalism
- **Vercel AI SDK** — стриминг ответов (OpenAI / Anthropic)
- **NextAuth.js v5** — аутентификация (Google, GitHub, email)
- **PostgreSQL + Prisma** — хранение данных
- **Zustand** — клиентский стейт
- **Framer Motion** — анимации
- **Tiptap** — редактор документов

## Запуск

```bash
npm install
cp .env.example .env        # заполнить ключи
npx prisma db push           # создать таблицы
npm run dev                  # http://localhost:3000
```

## Переменные окружения (.env)

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Секрет NextAuth |
| `AUTH_GOOGLE_ID/SECRET` | Google OAuth (опционально) |
| `AUTH_GITHUB_ID/SECRET` | GitHub OAuth (опционально) |
| `OPENAI_API_KEY` | Ключ OpenAI |
| `ANTHROPIC_API_KEY` | Ключ Anthropic |

## Структура

```
src/
├── app/
│   ├── (app)/          # Основное приложение (chat, profile, settings)
│   ├── (auth)/         # Логин, регистрация
│   └── api/            # Chat streaming, conversations CRUD, auth
├── components/
│   ├── ui/             # Button, Avatar, Badge, Tooltip, Modal, Skeleton
│   ├── chat/           # ChatArea, MessageBubble, MessageInput, LegalReference
│   ├── sidebar/        # Sidebar, ConversationList, ConversationItem
│   ├── artifacts/      # ArtifactPanel, DocumentEditor, DocumentPreview
│   └── legal-tools/    # ToolsPanel (договоры, иски, жалобы, анализ НПА)
├── stores/             # Zustand (chat, sidebar, artifact)
├── lib/                # Prisma, auth, utils, constants
└── types/              # TypeScript-типы
```

## Функционал

- Чат с AI — стриминг, markdown, подсветка кода
- Кликабельные ссылки на статьи НПА с попапом текста и статусом актуальности
- Панель артефактов — просмотр / редактирование / исходник документов
- 6 юридических инструментов — договоры, иски, жалобы, поиск НПА, проверка актуальности, консультации
- История чатов с группировкой по датам и поиском
- Светлая и тёмная тема
- Загрузка файлов (PDF, DOCX, изображения)
- Профиль и настройки с управлением API-ключами

## Дизайн

Стиль: **Soft Corporate Minimalism** — подробности в [STYLEGUIDE.md](STYLEGUIDE.md)
