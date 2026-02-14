# Leema — Юридический AI-ассистент

AI-платформа для работы с нормативно-правовыми актами. Движок понимает связи между статьями, проверяет актуальность и помогает создавать юридические документы.

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — дизайн-система Soft Corporate Minimalism
- **Vercel AI SDK** — стриминг (OpenAI, Anthropic)
- **Moonshot API** — Kimi K2.5 с веб-поиском
- **NextAuth.js v5** — JWT, Credentials, Google OAuth, 2FA TOTP
- **PostgreSQL + Prisma** — 40+ моделей
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
npx prisma db seed           # начальные данные (планы, Фемида)
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

### Юридические инструменты
- 6 инструментов + 7 шаблонов документов с формами заполнения
- Ссылки на статьи НПА с попапом текста и статусом актуальности
- Панель артефактов: просмотр / редактирование / исходник
- Экспорт в DOCX, PDF, TXT

### Навыки и агенты
- Кастомные навыки с системным промптом, правилами цитирования, юрисдикцией
- Кастомные агенты с загруженными файлами-контекстом
- Системные агенты (Фемида и др.) — управление из админки
- Маркетплейс навыков, модерация

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
Полная панель управления — 25+ страниц. Подробности в [ADMINGUIDE.md](ADMINGUIDE.md).

### Мониторинг
- `/api/metrics` — Prometheus-метрики
- `/api/health` — health-check (БД, провайдеры, MCP)
- Docker Compose: Prometheus + Grafana + алерты + дашборд

## Документация

- [STYLEGUIDE.md](STYLEGUIDE.md) — дизайн-система
- [USERGUIDE.md](USERGUIDE.md) — руководство пользователя
- [ADMINGUIDE.md](ADMINGUIDE.md) — руководство администратора
- [CLAUDE.md](CLAUDE.md) — контекст для Claude Code
