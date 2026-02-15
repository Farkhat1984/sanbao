# Sanbao — универсальный AI-ассистент

Универсальная AI-платформа с модульной иерархией Agent → Plugin → Skill → Tool → MCP. Всё управляется из админки: системные агенты, инструменты с шаблонами, плагины, навыки, MCP-серверы.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — дизайн-система Soft Corporate Minimalism
- **Vercel AI SDK** — стриминг (OpenAI, Anthropic)
- **Moonshot API** — Kimi K2.5 с веб-поиском
- **NextAuth.js v5** — JWT, Credentials, Google OAuth, 2FA TOTP
- **PostgreSQL + Prisma** — 50+ моделей
- **Stripe** — оплата, webhook, промокоды
- **S3/MinIO** — файловое хранилище
- **Prometheus + Grafana** — мониторинг
- **Zustand** — клиентский стейт
- **Tiptap** — редактор документов
- **Framer Motion** — анимации

## Запуск

```bash
npm install
cp .env.example .env        # заполнить ключи
npx prisma db push           # создать таблицы
npx prisma db seed           # начальные данные (планы, агенты, инструменты)
npm run dev                  # http://localhost:3000
```

## Переменные окружения

| Переменная | Описание | Обязательно |
|------------|----------|:-----------:|
| `DATABASE_URL` | PostgreSQL connection string | да |
| `NEXTAUTH_SECRET` | Секрет NextAuth | да |
| `MOONSHOT_API_KEY` | Kimi K2.5 (дефолтный TEXT-провайдер) | да |
| `AUTH_GOOGLE_ID/SECRET` | Google OAuth | нет |
| `DEEPINFRA_API_KEY` | DeepInfra Flux (IMAGE) | нет |
| `STRIPE_SECRET_KEY` | Stripe API | нет |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook подпись | нет |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | S3/MinIO хранилище | нет |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email-рассылки | нет |
| `ENCRYPTION_KEY` | AES-256-GCM для API-ключей | нет |
| `ADMIN_IP_WHITELIST` | IP-адреса для доступа к админке (через запятую) | нет |

## Функционал

### Чат и AI
- Мультипровайдер: Kimi K2.5, OpenAI, Anthropic — динамическая маршрутизация из БД
- NDJSON-стриминг, markdown, подсветка кода, reasoning mode
- Веб-поиск, автокомпакция контекста, пользовательская память
- A/B тестирование промптов, фильтр контента

### Инструменты и шаблоны
- Модульная система Tool (типы: PROMPT_TEMPLATE, WEBHOOK, URL, FUNCTION)
- Каждый инструмент — config с промптом и шаблонами (формы с полями)
- Ссылки на статьи НПА с попапом текста и статусом актуальности
- Панель артефактов: просмотр / редактирование / исходник
- Экспорт в DOCX, PDF, TXT

### Агенты, навыки, плагины
- **Агенты**: системные (из админки) и пользовательские с файлами-контекстом
- **Навыки**: промпт + правила цитирования + юрисдикция, маркетплейс
- **Плагины**: пакеты из tools + skills + MCP-серверов
- **Иерархия**: Agent → Tools, Agent → Skills, Agent → Plugins → (Tools + Skills + MCP)
- Всё резолвится через `resolveAgentContext()` с дедупликацией

### Биллинг
- Stripe Checkout с промокодами и пробным периодом
- Webhook: автоназначение подписки, invoice-email, downgrade при отмене
- Ручное управление подписками из админки
- Тарифные планы с гранулярными лимитами и feature-флагами

### Безопасность
- 2FA TOTP (Google Authenticator), обязательная для админов
- IP whitelist для админ-панели
- Rate-limiting с автоблокировкой при abuse
- Шифрование API-ключей AES-256-GCM
- Session TTL из настроек

### Админ-панель (`/admin`)
Полная панель управления — 27+ страниц, включая CRUD для инструментов и плагинов. Подробности в [ADMINGUIDE.md](ADMINGUIDE.md).

### Мониторинг
- `/api/metrics` — Prometheus-метрики
- `/api/health` — health-check (БД, провайдеры, MCP)
- Docker Compose: Prometheus + Grafana + алерты + дашборд

## Документация

- [STYLEGUIDE.md](STYLEGUIDE.md) — дизайн-система
- [USERGUIDE.md](USERGUIDE.md) — руководство пользователя
- [ADMINGUIDE.md](ADMINGUIDE.md) — руководство администратора
- [CLAUDE.md](CLAUDE.md) — контекст для Claude Code
