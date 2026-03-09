# SANBAO — TODOLIST: Monorepo + Mobile App (Capacitor)

> Created: 2026-03-09 | Goal: Split monolith → Turborepo monorepo, build native mobile app
> Estimated: 2-3 weeks | Status: Phase 0-5 Complete, Phase 6-7 Remaining

---

## Overview

Текущая структура — единый Next.js проект со смешанным server/client кодом в одном `package.json`.
Для Capacitor (iOS/Android) нужно разделить на:

```
sanbao/
├── turbo.json
├── package.json                  # workspace root
├── apps/
│   ├── web/                      # Next.js (API routes + SSR + Admin)
│   └── mobile/                   # Capacitor + Vite + React
├── packages/
│   ├── ui/                       # React компоненты (chat, sidebar, agents...)
│   ├── shared/                   # types, constants, i18n, utils, validation
│   └── stores/                   # 14 Zustand stores
```

---

## Phase 0 — Подготовка (1 день)

### 0.1 [x] Инициализация Turborepo
- Установить `turbo` в root
- Создать `turbo.json` с pipeline (build, lint, test, dev)
- Конвертировать root `package.json` в workspace root
- Настроить `"workspaces": ["apps/*", "packages/*"]`
- Проверить что `npm run dev` / `npm run build` работают как раньше

### 0.2 [x] Аудит импортов — карта зависимостей
- Составить список всех `src/lib/*.ts` с пометкой server-only / client-safe / mixed
- Найти все circular dependencies между lib модулями
- Определить модули которые используются и в компонентах и в API routes (mixed)
- Результат → `docs/IMPORT_MAP.md`

### 0.3 [x] Настроить path aliases для packages
- Добавить `@sanbao/ui`, `@sanbao/shared`, `@sanbao/stores` в tsconfig paths
- Убедиться что ESLint и TypeScript резолвят пакеты
- Настроить `tsconfig.base.json` в корне

---

## Phase 1 — packages/shared (2 дня)

Вынести код который нужен и web и mobile — типы, константы, утилиты.

### 1.1 [x] Создать packages/shared
- `packages/shared/package.json` с `"name": "@sanbao/shared"`
- `packages/shared/tsconfig.json` extends root
- Настроить exports (ESM)

### 1.2 [x] Перенести типы
- `src/lib/types/mcp.ts` → `packages/shared/types/mcp.ts`
- `src/types/*.ts` → `packages/shared/types/`
- Создать `packages/shared/types/index.ts` barrel export
- Обновить все импорты в src/ на `@sanbao/shared/types`

### 1.3 [x] Перенести константы
- `src/lib/constants.ts` → `packages/shared/constants.ts`
- Разделить: client-safe константы vs server-only (DB limits, BCRYPT_SALT_ROUNDS)
- Server-only оставить в `apps/web/src/lib/server-constants.ts`
- Обновить импорты

### 1.4 [x] Перенести утилиты
- `src/lib/utils.ts` → `packages/shared/utils.ts` (cn, formatDate, etc.)
- `src/lib/validation.ts` → `packages/shared/validation.ts` (Zod schemas client-safe)
- Server-only валидацию (Prisma-зависимую) оставить в web
- Обновить импорты

### 1.5 [x] Перенести i18n
- `src/lib/i18n.ts` → `packages/shared/i18n.ts`
- `src/messages/ru.json` → `packages/shared/messages/ru.json`
- `src/messages/kk.json` → `packages/shared/messages/kk.json`
- Обновить импорты

### 1.6 [x] Тесты shared пакета
- Перенести релевантные тесты из `src/__tests__/lib/`
- Убедиться `turbo run test` прогоняет тесты shared
- CI зелёный

---

## Phase 2 — packages/stores (1-2 дня)

Вынести Zustand stores — они нужны и web и mobile.

### 2.1 [x] Создать packages/stores
- `packages/stores/package.json` с `"name": "@sanbao/stores"`
- Зависимости: `zustand`, `@sanbao/shared`

### 2.2 [x] Перенести stores
- `src/stores/chatStore.ts` → `packages/stores/chatStore.ts`
- `src/stores/agentStore.ts` → `packages/stores/agentStore.ts`
- `src/stores/artifactStore.ts` → `packages/stores/artifactStore.ts`
- `src/stores/articleStore.ts` → `packages/stores/articleStore.ts`
- `src/stores/sourceStore.ts` → `packages/stores/sourceStore.ts`
- `src/stores/panelStore.ts` → `packages/stores/panelStore.ts`
- `src/stores/sidebarStore.ts` → `packages/stores/sidebarStore.ts`
- `src/stores/taskStore.ts` → `packages/stores/taskStore.ts`
- `src/stores/skillStore.ts` → `packages/stores/skillStore.ts`
- `src/stores/memoryStore.ts` → `packages/stores/memoryStore.ts`
- `src/stores/billingStore.ts` → `packages/stores/billingStore.ts`
- `src/stores/onboardingStore.ts` → `packages/stores/onboardingStore.ts`
- `src/stores/orgStore.ts` → `packages/stores/orgStore.ts`
- `src/stores/integrationStore.ts` → `packages/stores/integrationStore.ts`
- `src/stores/resetStores.ts` → `packages/stores/resetStores.ts`

### 2.3 [x] Разорвать server-зависимости в stores
- Проверить что ни один store не импортирует из `src/lib/prisma`, `src/lib/redis`, etc.
- Если есть — вынести серверную логику в отдельный модуль, store оставить чистым
- API вызовы в stores должны использовать `@sanbao/shared` api-client (fetch-based)

### 2.4 [x] Перенести тесты stores
- `src/__tests__/stores/` → `packages/stores/__tests__/`
- Проверить что все тесты проходят

---

## Phase 3 — packages/ui (3-4 дня)

Самый объёмный этап — вынести React компоненты.

### 3.1 [x] Создать packages/ui
- `packages/ui/package.json` с `"name": "@sanbao/ui"`
- Зависимости: `react`, `lucide-react`, `framer-motion`, `clsx`, `tailwind-merge`, `@sanbao/shared`, `@sanbao/stores`
- Настроить Tailwind CSS v4 для пакета

### 3.2 [x] Перенести UI primitives (shadcn)
- `src/components/ui/*` → `packages/ui/components/ui/`
- Это базовые компоненты: Button, Input, Dialog, Select, etc.
- Обновить импорты во всех потребителях

### 3.3 [x] Перенести chat компоненты
- `src/components/chat/*` → `packages/ui/components/chat/`
- MessageBubble, MessageAvatar, MessageActions, ReasoningBlock
- CollapseOverlay, SwarmResponses, AssistantContent
- ChatArea, MessageInput, StarterPromptsEditor
- WelcomeScreen, ToolsPanel

### 3.4 [x] Перенести sidebar компоненты
- `src/components/sidebar/*` → `packages/ui/components/sidebar/`

### 3.5 [x] Перенести agents/skills/artifacts компоненты
- `src/components/agents/*` → `packages/ui/components/agents/`
- `src/components/skills/*` → `packages/ui/components/skills/`
- `src/components/artifacts/*` → `packages/ui/components/artifacts/`

### 3.6 [x] Перенести остальные shared компоненты
- `src/components/panel/*` → `packages/ui/components/panel/`
- `src/components/billing/*` → `packages/ui/components/billing/`
- `src/components/layout/*` → `packages/ui/components/layout/`
- `src/components/memory/*` → `packages/ui/components/memory/`
- `src/components/tasks/*` → `packages/ui/components/tasks/`
- `src/components/settings/*` → `packages/ui/components/settings/`
- `src/components/onboarding/*` → `packages/ui/components/onboarding/`

### 3.7 [x] Оставить в apps/web (НЕ переносить)
- `src/components/admin/*` — только для web админки
- `src/components/legal-tools/*` — специфично для web
- `src/components/providers/*` — NextAuth/Theme providers (web-specific)

### 3.8 [x] Перенести hooks
- `src/hooks/useIsMobile.ts` → `packages/ui/hooks/useIsMobile.ts`
- `src/hooks/useTranslation.ts` → `packages/ui/hooks/useTranslation.ts`
- `src/hooks/useCopyToClipboard.ts` → `packages/ui/hooks/useCopyToClipboard.ts`
- `src/hooks/useInfiniteScroll.ts` → `packages/ui/hooks/useInfiniteScroll.ts`
- `src/hooks/usePrintArtifact.ts` → `packages/ui/hooks/usePrintArtifact.ts`
- `src/hooks/useArtifactExport.ts` → `packages/ui/hooks/useArtifactExport.ts`
- Оставить в web: `useAdminList.ts`, `useAdminCrud.ts` (admin-only)

### 3.9 [x] Тесты и сборка packages/ui
- Настроить Vitest для packages/ui
- Убедиться что Tailwind стили работают при импорте из пакета
- `turbo run build` — все пакеты собираются

---

## Phase 4 — apps/web рефакторинг (2 дня)

Превратить текущий src/ в apps/web/, заменить локальные импорты на пакетные.

### 4.1 [x] Переместить оставшийся код в apps/web
- `src/app/` → `apps/web/src/app/` (все routes + API routes)
- `src/lib/` (server-only) → `apps/web/src/lib/`
- `src/proxy.ts` → `apps/web/src/proxy.ts`
- `src/instrumentation.ts` → `apps/web/src/instrumentation.ts`

### 4.2 [x] Перенести конфиги
- `next.config.ts` → `apps/web/next.config.ts`
- `tsconfig.json` → `apps/web/tsconfig.json` (extends root)
- `Dockerfile` → `apps/web/Dockerfile`
- `docker-compose.prod.yml` → root (управляет всем)
- `prisma/` → `apps/web/prisma/`
- `vitest.config.ts` → `apps/web/vitest.config.ts`

### 4.3 [x] Обновить apps/web/package.json
- Оставить только server-only зависимости:
  - `@prisma/client`, `prisma`, `ioredis`, `bullmq`
  - `stripe`, `nodemailer`, `@aws-sdk/*`, `@napi-rs/canvas`
  - `bcryptjs`, `otplib`, `qrcode`, `mammoth`, `pdf-parse`, `officeparser`
  - `next`, `next-auth`, `@sentry/nextjs`, `@modelcontextprotocol/sdk`
- Добавить workspace deps: `@sanbao/ui`, `@sanbao/shared`, `@sanbao/stores`

### 4.4 [x] Массовый поиск/замена импортов
- `from '@/stores/` → `from '@sanbao/stores/`
- `from '@/components/ui/` → `from '@sanbao/ui/components/ui/`
- `from '@/components/chat/` → `from '@sanbao/ui/components/chat/`
- `from '@/lib/constants'` → `from '@sanbao/shared/constants'`
- `from '@/lib/utils'` → `from '@sanbao/shared/utils'`
- `from '@/hooks/` → `from '@sanbao/ui/hooks/`
- И т.д. по всем перенесённым модулям

### 4.5 [x] Обновить Docker
- `apps/web/Dockerfile` — пути к prisma, node_modules
- `docker-compose.prod.yml` — build context → `apps/web/`
- Проверить deploy.sh работает

### 4.6 [x] Полный прогон тестов + build
- `turbo run lint` — 0 ошибок
- `turbo run test` — все тесты проходят
- `turbo run build` — web собирается
- Docker build → проверка на staging

---

## Phase 5 — apps/mobile (3-4 дня)

Создать мобильное приложение на Capacitor + Vite + React.

### 5.1 [x] Scaffolding мобильного приложения
- `npm create vite apps/mobile -- --template react-ts`
- Установить: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- Установить: `@sanbao/ui`, `@sanbao/shared`, `@sanbao/stores`
- Настроить Tailwind CSS v4
- Настроить `capacitor.config.ts` (appId: `com.sanbao.sanbaoai`, webDir: `dist`)

### 5.2 [x] API Client для мобилки
- Создать `apps/mobile/src/lib/api-client.ts`
- Base URL: `https://sanbao.ai/api` (production) / env variable (dev)
- Auth: Bearer token (из `mobile-auth.ts` — уже есть на backend)
- Обёртка для NDJSON streaming (`/api/chat`)
- Обёртка для REST CRUD (conversations, agents, skills)

### 5.3 [x] Мобильная авторизация
- Экран Login: Email + Password, Google Sign-In, Apple Sign-In
- Использовать `POST /api/auth/apple`, `POST /api/auth/mobile/google` (уже есть)
- Secure storage для Bearer token (`@capacitor/preferences` или Keychain)
- Auto-refresh token logic

### 5.4 [x] Навигация (React Router или Ionic Router)
- `/chat` — список чатов + чат
- `/chat/:id` — конкретный чат
- `/agents` — список агентов
- `/agents/:id` — детали агента
- `/profile` — профиль пользователя
- `/settings` — настройки
- `/billing` — подписка
- Tab bar: Чаты | Агенты | Профиль

### 5.5 [x] Основные экраны
- **Chat** — использовать `@sanbao/ui/components/chat` + адаптировать для мобильной навигации
- **Agents** — список + карточки из `@sanbao/ui/components/agents`
- **Profile/Settings** — мобильный layout
- Адаптировать компоненты под touch (увеличить tap targets, swipe gestures)

### 5.6 [x] Capacitor плагины
- `@capacitor/push-notifications` — push уведомления (FCM + APNs)
- `@capacitor/haptics` — тактильная обратная связь
- `@capacitor/status-bar` — управление status bar
- `@capacitor/keyboard` — управление клавиатурой (insets, show/hide)
- `@capacitor/splash-screen` — splash screen
- `@capacitor/app` — deep links, app state
- `@capacitor/share` — шаринг контента

### 5.7 [x] Offline support (базовый)
- Кэширование списка чатов и последних сообщений в localStorage
- Показ cached данных при отсутствии сети
- Queue отправки сообщений (retry при восстановлении сети)
- Offline-индикатор в UI

### 5.8 [x] iOS сборка
- `npx cap add ios`
- Xcode project setup (Bundle ID, signing, capabilities)
- Push notification entitlement
- App Store Connect — создать app record
- TestFlight internal testing

### 5.9 [x] Android сборка
- `npx cap add android`
- Android Studio project setup
- Firebase project (FCM push)
- Google Play Console — internal testing track

---

## Phase 6 — Интеграция и polish (2-3 дня)

### 6.1 [x] Push-уведомления end-to-end
- Backend: `apps/web/src/lib/push.ts` — отправка push через FCM/APNs
- Prisma: добавить `DeviceToken` модель (userId, token, platform, createdAt)
- API: `POST /api/devices` — регистрация device token
- Триггеры: новое сообщение, упоминание, системное уведомление
- Mobile: обработка push → навигация к нужному экрану

### 6.2 [x] Deep linking
- URL scheme: `sanbao://`
- Universal links: `https://sanbao.ai/chat/[id]` → открытие в приложении
- `article://` protocol → открытие в мобилке
- Apple App Site Association + Android App Links

### 6.3 [x] Biometric auth
- `@capacitor/biometrics` или community plugin
- Face ID / Touch ID / Fingerprint для разблокировки
- Опционально: biometrics вместо пароля при login

### 6.4 [ ] CI/CD для мобилки
- GitHub Actions: build iOS (Xcode Cloud или Fastlane)
- GitHub Actions: build Android (Gradle)
- Auto-deploy to TestFlight / Play Console internal track
- Version bump automation

### 6.5 [x] Performance
- Lazy loading экранов (React.lazy + Suspense)
- Image optimization (resize перед отправкой)
- Виртуализация длинных списков чатов/сообщений
- Bundle size анализ (< 2MB initial)

### 6.6 [ ] QA и тестирование
- E2E тесты мобилки (Detox или Maestro)
- Тестирование на реальных устройствах (iPhone 13+, Samsung Galaxy S21+)
- Edge cases: slow network, background/foreground, memory pressure
- Accessibility: VoiceOver (iOS), TalkBack (Android)

---

## Phase 7 — Release (1-2 дня)

### 7.1 [ ] App Store submission
- Screenshots (6.7", 5.5" iPhone, iPad)
- App description (RU + EN)
- Privacy policy URL (`https://sanbao.ai/privacy`)
- App Review guidelines compliance
- Submit for review

### 7.2 [ ] Google Play submission
- Screenshots (phone + tablet)
- Store listing (RU + EN)
- Privacy policy + Data safety form
- Content rating questionnaire
- Internal → Closed → Open → Production rollout

### 7.3 [ ] Post-launch
- Мониторинг crash reports (Sentry mobile SDK)
- User feedback loop
- Analytics: screen views, feature usage
- OTA updates через Capacitor Live Updates (опционально)

---

## Зависимости server-only vs client-safe

### Server-only (остаётся в apps/web)
```
@prisma/client, @prisma/extension-read-replicas
ioredis, bullmq
stripe, nodemailer
@aws-sdk/client-s3, @aws-sdk/s3-request-presigner
@napi-rs/canvas, qrcode
bcryptjs, otplib
mammoth, pdf-parse, officeparser
@modelcontextprotocol/sdk
@sentry/nextjs
next-auth, @auth/prisma-adapter
```

### Client-safe (переносится в packages или apps/mobile)
```
react, react-dom
zustand
framer-motion, lucide-react
@tiptap/* (rich text editor)
react-markdown, remark-gfm, rehype-highlight
clsx, tailwind-merge
zod (client-safe schemas only)
docx, jspdf, xlsx, html2canvas-pro (export)
file-saver
next-themes
```

### Mobile-specific (только apps/mobile)
```
@capacitor/core, @capacitor/cli
@capacitor/ios, @capacitor/android
@capacitor/push-notifications
@capacitor/haptics, @capacitor/status-bar
@capacitor/keyboard, @capacitor/splash-screen
@capacitor/app, @capacitor/share, @capacitor/preferences
```

---

## Критический путь

```
Phase 0 (1д) → Phase 1 (2д) → Phase 2 (1д) → Phase 3 (3д) → Phase 4 (2д) → Phase 5 (3д) → Phase 6 (2д) → Phase 7 (1д)
              \_______________ packages _______________/    \__ web __/    \_______ mobile _______/
```

**Минимум до рабочей мобилки:** Phase 0-5 = ~12 рабочих дней
**До релиза в сторы:** + Phase 6-7 = ~15 рабочих дней

---

## Правила работы

1. **Каждый phase = отдельный PR** — не мешать всё в один коммит
2. **Web не должен ломаться** — после каждого phase `npm run build` + тесты зелёные
3. **Инкрементальная миграция** — можно держать дубли импортов (old + new) пока переход не завершён
4. **Mobile MVP** — сначала Chat + Auth, потом остальные экраны
5. **Один пакет за раз** — не начинать Phase 3 пока Phase 1-2 не завершены и стабильны
