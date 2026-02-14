# Leema — Юридический AI-ассистент

AI-платформа для работы с нормативно-правовыми актами. Собственный движок понимает связи между статьями, проверяет актуальность и помогает создавать юридические документы.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — дизайн-система Soft Corporate Minimalism
- **Vercel AI SDK** — стриминг ответов (OpenAI / Anthropic)
- **Moonshot API** — Kimi K2.5 с веб-поиском
- **NextAuth.js v5** — аутентификация (Google, GitHub, email)
- **PostgreSQL + Prisma** — хранение данных
- **Zustand** — клиентский стейт
- **Framer Motion** — анимации
- **Tiptap** — редактор документов (таблицы, выравнивание, подсветка)
- **docx / html2pdf.js** — экспорт документов в DOCX и PDF

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
| `MOONSHOT_API_KEY` | Ключ Moonshot / Kimi K2.5 |

## Структура

```
src/
├── app/
│   ├── (app)/          # Основное приложение (chat, profile, settings, billing)
│   ├── (auth)/         # Логин, регистрация
│   └── api/            # Chat streaming, conversations CRUD, auth, tasks, memory
├── components/
│   ├── ui/             # Button, Avatar, Badge, Tooltip, Modal, Skeleton
│   ├── chat/           # ChatArea, MessageBubble, MessageInput, LegalReference
│   ├── sidebar/        # Sidebar, ConversationList, ConversationItem
│   ├── artifacts/      # ArtifactPanel, DocumentEditor, EditorToolbar, DocumentPreview
│   ├── legal-tools/    # ToolsPanel, TemplateModal (шаблоны документов)
│   ├── skills/         # Навыки и промпты
│   ├── agents/         # Кастомные AI-агенты
│   └── tasks/          # Чек-листы задач
├── stores/             # Zustand (chat, sidebar, artifact, skill, agent, task, memory)
├── lib/                # Prisma, auth, utils, export-docx, export-pdf, legal-templates
└── types/              # TypeScript-типы
```

## Функционал

### Чат и AI
- Мультипровайдер: Kimi K2.5 (Moonshot), OpenAI, Anthropic
- Стриминг ответов, markdown, подсветка кода
- Режим рассуждений (extended thinking) с раскрывающимся блоком
- Веб-поиск через встроенный инструмент Moonshot
- Автокомпакция контекста при переполнении окна
- Пользовательская память (persistent context)

### Юридические инструменты
- 6 инструментов: договоры, иски, жалобы, поиск НПА, проверка актуальности, консультации
- 7 шаблонов документов с формой заполнения (договор услуг/купли-продажи/аренды, иск о долге/убытках, жалоба в госорган/апелляция)
- Кликабельные ссылки на статьи НПА с попапом текста и статусом актуальности

### Документы и артефакты
- Панель артефактов справа — просмотр / редактирование / исходник
- Экспорт в DOCX (Word), PDF и TXT
- Редактор с тулбаром: жирный, курсив, подчёркивание, подсветка, заголовки H1-H3, списки, выравнивание, таблицы
- Превью в стиле A4-страницы с юридической типографикой (Times New Roman, поля, justified)
- Типы документов: CONTRACT, CLAIM, COMPLAINT, DOCUMENT, CODE, ANALYSIS

### Навыки и агенты
- Кастомные навыки (skills) с системным промптом, правилами цитирования и юрисдикцией
- Кастомные агенты с загруженными файлами-контекстом
- Маркетплейс навыков

### Прочее
- История чатов с группировкой по датам и поиском
- Светлая и тёмная тема
- Загрузка файлов (PDF, DOCX, XLSX, изображения) с автоизвлечением текста
- Голосовой ввод (Web Speech API, ru-RU)
- Тарифные планы и отслеживание лимитов
- Админ-панель

## Дизайн

Стиль: **Soft Corporate Minimalism** — подробности в [STYLEGUIDE.md](STYLEGUIDE.md)
