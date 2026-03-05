# INTEGRATION.md — Организации + AI-агенты из документов

> Пользователь создаёт организацию → загружает документы → получает AI-агентов → даёт доступ сотрудникам по email.
> Интеграция Sanbao (Next.js) + AI Cortex (Orchestrator + FragmentDB).

---

## 1. Общая схема

```
Пользователь (владелец)
  │
  │ Создаёт организацию "АО Банк"
  │ Приглашает сотрудников по email
  │ Загружает документы → создаёт агентов
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  Sanbao (Next.js, :3004)                                    │
│                                                              │
│  Organization ← владелец (User)                              │
│    ├── OrgMember ← сотрудники (User, роли: OWNER/ADMIN/USER)│
│    ├── OrgAgent  ← агенты организации                        │
│    │     ├── Привязка к MCP-эндпоинту (AI Cortex)            │
│    │     └── Доступ: все сотрудники или конкретные            │
│    └── OrgInvite ← приглашения по email                      │
│                                                              │
│  При загрузке документов:                                    │
│    Sanbao → POST /api/namespaces (создать namespace)         │
│    Sanbao → POST /api/projects (создать проект)              │
│    Sanbao → POST /api/projects/{id}/upload (файлы)           │
│    Sanbao → POST /api/projects/{id}/process (запустить)      │
│    Sanbao → POST /api/projects/{id}/publish (опубликовать)   │
│         ↓                                                    │
│    Получить MCP URL → сохранить в McpServer + OrgAgent       │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP (nskey_...)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  AI Cortex — Orchestrator (:8120)                             │
│                                                               │
│  namespace "org_abc123"                                       │
│    ├── project "internal_docs" → MCP endpoint                 │
│    ├── project "hr_policies"   → MCP endpoint                 │
│    └── каждый проект = отдельный агент с search/sql/graph     │
│                                                               │
│  Все данные изолированы по namespace (nskey_ ключи)           │
└──────────────────────┬────────────────────────────────────────┘
                       │ HTTP
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  FragmentDB (:8110)                                           │
│                                                               │
│  Коллекции с префиксом: ns_org_abc123_internal_docs          │
│  Векторы, BM25, граф — всё изолировано                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Новые Prisma-модели

Добавить в `prisma/schema.prisma`:

```prisma
// ─── Organizations ──────────────────────────────────────

model Organization {
  id          String   @id @default(cuid())
  name        String                          // "АО Банк"
  slug        String   @unique                // "ao-bank" (URL-safe)
  ownerId     String
  avatar      String?  @db.Text
  namespace   String   @unique                // AI Cortex namespace name (= id или slug)
  nsApiKey    String?  @db.Text               // nskey_... (зашифрован AES-256-GCM)

  owner   User          @relation("OrgOwner", fields: [ownerId], references: [id])
  members OrgMember[]
  agents  OrgAgent[]
  invites OrgInvite[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}

model OrgMember {
  id     String  @id @default(cuid())
  orgId  String
  userId String
  role   OrgRole @default(MEMBER)

  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  joinedAt DateTime @default(now())

  @@unique([orgId, userId])
  @@index([userId])
}

model OrgAgent {
  id          String  @id @default(cuid())
  orgId       String
  name        String                          // "Юрист по внутренним документам"
  description String? @db.Text
  projectId   String?                         // AI Cortex pipeline project ID
  mcpServerId String?                         // → McpServer (MCP endpoint)
  status      OrgAgentStatus @default(CREATING)
  accessMode  OrgAgentAccess @default(ALL_MEMBERS) // кто имеет доступ

  org       Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  mcpServer McpServer?       @relation(fields: [mcpServerId], references: [id])
  files     OrgAgentFile[]
  access    OrgAgentAccess[]  // если accessMode = SPECIFIC

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId])
}

model OrgAgentFile {
  id         String @id @default(cuid())
  orgAgentId String
  fileName   String
  fileType   String
  fileSize   Int
  fileUrl    String

  orgAgent OrgAgent @relation(fields: [orgAgentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([orgAgentId])
}

model OrgAgentMember {
  id         String @id @default(cuid())
  orgAgentId String
  userId     String

  orgAgent OrgAgent @relation(fields: [orgAgentId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([orgAgentId, userId])
}

model OrgInvite {
  id     String        @id @default(cuid())
  orgId  String
  email  String
  role   OrgRole       @default(MEMBER)
  status InviteStatus  @default(PENDING)
  token  String        @unique @default(cuid())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  expiresAt DateTime                        // +7 дней

  @@index([email])
  @@index([orgId])
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

enum OrgAgentStatus {
  CREATING        // проект создан, файлы загружаются
  PROCESSING      // пайплайн работает
  READY           // обработан, не опубликован
  PUBLISHED       // MCP endpoint готов
  ERROR           // ошибка пайплайна
}

enum InviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
}
```

**Также добавить связи в существующие модели:**

```prisma
// В model User добавить:
  ownedOrgs     Organization[] @relation("OrgOwner")
  orgMembers    OrgMember[]
  orgAgentAccess OrgAgentMember[]

// В model McpServer добавить:
  orgAgents     OrgAgent[]
```

---

## 3. API Routes (Sanbao)

### 3.1 Организации

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/api/organizations` | Создать организацию |
| `GET` | `/api/organizations` | Мои организации (owner + member) |
| `GET` | `/api/organizations/[id]` | Детали организации |
| `PUT` | `/api/organizations/[id]` | Обновить (name, avatar) |
| `DELETE` | `/api/organizations/[id]` | Удалить (только owner) |

### 3.2 Участники

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/api/organizations/[id]/members` | Список участников |
| `POST` | `/api/organizations/[id]/invite` | Пригласить по email |
| `POST` | `/api/organizations/invite/accept` | Принять приглашение (по token) |
| `PUT` | `/api/organizations/[id]/members/[userId]` | Изменить роль |
| `DELETE` | `/api/organizations/[id]/members/[userId]` | Удалить участника |

### 3.3 Агенты организации

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/api/organizations/[id]/agents` | Создать агента (name + описание) |
| `GET` | `/api/organizations/[id]/agents` | Список агентов |
| `GET` | `/api/organizations/[id]/agents/[agentId]` | Детали + статус пайплайна |
| `DELETE` | `/api/organizations/[id]/agents/[agentId]` | Удалить агента |
| `POST` | `/api/organizations/[id]/agents/[agentId]/upload` | Загрузить файлы |
| `POST` | `/api/organizations/[id]/agents/[agentId]/process` | Запустить обработку |
| `POST` | `/api/organizations/[id]/agents/[agentId]/publish` | Опубликовать |
| `GET` | `/api/organizations/[id]/agents/[agentId]/progress` | SSE прогресс |
| `PUT` | `/api/organizations/[id]/agents/[agentId]/access` | Настроить доступ |

---

## 4. Flow: создание организации

```
POST /api/organizations
Body: { name: "АО Банк" }

Sanbao:
  1. Создать Organization в Prisma (slug = slugify(name), namespace = id)
  2. Создать OrgMember (userId = current user, role = OWNER)
  3. Вызвать AI Cortex:
     POST http://orchestrator:8120/api/namespaces
     Body: { "name": org.id, "display_name": org.name }
  4. Получить nskey_... → зашифровать AES-256-GCM → сохранить в org.nsApiKey
  5. Вернуть организацию клиенту
```

---

## 5. Flow: приглашение сотрудника

```
POST /api/organizations/[id]/invite
Body: { email: "almas@bank.kz", role: "MEMBER" }

Sanbao:
  1. Проверить: текущий user = OWNER или ADMIN
  2. Создать OrgInvite (token = cuid, expiresAt = now + 7 дней)
  3. Если пользователь с таким email уже есть:
     → Отправить email "Вас пригласили в организацию АО Банк"
     → Ссылка: https://sanbao.ai/invite/[token]
  4. Если пользователя нет:
     → Отправить email "Зарегистрируйтесь и присоединитесь к АО Банк"
     → Ссылка: https://sanbao.ai/register?invite=[token]

POST /api/organizations/invite/accept
Body: { token: "clx..." }

Sanbao:
  1. Найти OrgInvite по token, проверить expiresAt
  2. Создать OrgMember (userId = current user, role = invite.role)
  3. Обновить invite.status = ACCEPTED
  4. Пользователь видит организацию в списке + доступные агенты
```

---

## 6. Flow: создание агента из документов

Это **главный flow** — владелец/админ загружает документы и получает работающего AI-агента.

```
Шаг 1: Создать агента
  POST /api/organizations/[orgId]/agents
  Body: { name: "Юрист по договорам", description: "..." }

  Sanbao:
    1. Создать OrgAgent (status = CREATING)
    2. Расшифровать org.nsApiKey
    3. Вызвать AI Cortex:
       POST http://orchestrator:8120/api/projects
       Headers: { Authorization: Bearer nskey_... }
       Body: { "name": orgAgent.id, "display_name": orgAgent.name }
    4. Сохранить projectId в OrgAgent

Шаг 2: Загрузить файлы
  POST /api/organizations/[orgId]/agents/[agentId]/upload
  Body: FormData (files[])

  Sanbao:
    1. Сохранить файлы в S3 → создать OrgAgentFile записи
    2. Проксировать каждый файл в AI Cortex:
       POST http://orchestrator:8120/api/projects/[projectId]/upload
       Headers: { Authorization: Bearer nskey_... }
       Body: FormData (file)

Шаг 3: Запустить обработку
  POST /api/organizations/[orgId]/agents/[agentId]/process

  Sanbao:
    1. Вызвать AI Cortex:
       POST http://orchestrator:8120/api/projects/[projectId]/process
       Headers: { Authorization: Bearer nskey_... }
    2. Обновить OrgAgent.status = PROCESSING

  Прогресс (SSE):
    GET /api/organizations/[orgId]/agents/[agentId]/progress
    → Sanbao проксирует:
      GET http://orchestrator:8120/api/projects/[projectId]/progress
    → Клиент видит: extracting → analyzing → chunking → embedding → ... → ready

Шаг 4: Опубликовать
  POST /api/organizations/[orgId]/agents/[agentId]/publish

  Sanbao:
    1. Вызвать AI Cortex:
       POST http://orchestrator:8120/api/projects/[projectId]/publish
       Headers: { Authorization: Bearer nskey_... }
    2. AI Cortex создаёт:
       → Домен: ns_{orgId}_{agentId}
       → Агент с MCP tools (search, sql_query, graph_traverse...)
       → MCP endpoint: http://orchestrator:8120/ns_{orgId}_{agentId}
    3. Sanbao создаёт McpServer:
       {
         name: orgAgent.name,
         url: "http://orchestrator:8120/ns_{orgId}_{agentId}",
         transport: STREAMABLE_HTTP,
         isGlobal: false,
         isEnabled: true
       }
    4. Связать: OrgAgent.mcpServerId = mcpServer.id
    5. Обновить OrgAgent.status = PUBLISHED
```

---

## 7. Flow: сотрудник чатится с агентом

```
Сотрудник Алмас открывает Sanbao → видит раздел "Организации"
  │
  ├── Список организаций, где он member
  │   └── "АО Банк"
  │       ├── Юрист по договорам (published)
  │       ├── HR-ассистент (published)
  │       └── Финансовый аналитик (processing...)
  │
  └── Нажимает "Юрист по договорам" → открывается чат
      │
      │  Sanbao при загрузке чата:
      │  1. Проверить: Алмас ∈ OrgMember (orgId = "АО Банк")
      │  2. Проверить: OrgAgent.accessMode = ALL_MEMBERS
      │     или Алмас ∈ OrgAgentMember
      │  3. Загрузить McpServer по OrgAgent.mcpServerId
      │  4. Подключить MCP tools в контекст чата
      │
      │  Алмас: "Какие условия расторжения договора аренды?"
      │     ↓
      │  route.ts → MCP tool call → orchestrator:8120/ns_{orgId}_{agentId}
      │     ↓
      │  AI Cortex: search по коллекции ns_{orgId}_{agentId}
      │     ↓
      │  Результат: релевантные фрагменты из документов банка
      │     ↓
      │  LLM формирует ответ с цитатами из документов
```

---

## 8. Страницы (фронтенд)

Новые маршруты в `src/app/(app)/`:

| Маршрут | Страница | Описание |
|---------|----------|----------|
| `/organizations` | Список организаций | Мои организации + кнопка "Создать" |
| `/organizations/new` | Создание | Форма: название, аватар |
| `/organizations/[id]` | Обзор организации | Участники, агенты, настройки |
| `/organizations/[id]/members` | Участники | Список + приглашение по email |
| `/organizations/[id]/agents` | Агенты | Список агентов + статусы |
| `/organizations/[id]/agents/new` | Создание агента | Имя, описание, загрузка файлов |
| `/organizations/[id]/agents/[agentId]` | Детали агента | Прогресс, файлы, доступ, статус |
| `/invite/[token]` | Принятие приглашения | Подтверждение вступления |

Sidebar — новая секция:

```
Организации
├── АО Банк
│   ├── Юрист по договорам     → открыть чат
│   └── HR-ассистент           → открыть чат
└── + Создать организацию
```

---

## 9. Env-переменные

Добавить в `.env` / `docker-compose.prod.yml`:

```bash
# AI Cortex Orchestrator URL (уже есть в docker-compose как orchestrator:8120)
AI_CORTEX_URL=http://orchestrator:8120

# Включить namespace-изоляцию в AI Cortex
# Добавить в environment orchestrator:
AI_CORTEX_ENABLE_NAMESPACES=true
```

---

## 10. Безопасность

### Авторизация

Каждый API-эндпоинт организации проверяет:

```typescript
// Проверка членства
async function requireOrgMember(orgId: string, userId: string, minRole?: OrgRole) {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } }
  });
  if (!member) throw new ForbiddenError();
  if (minRole && !hasRole(member.role, minRole)) throw new ForbiddenError();
  return member;
}

// Иерархия ролей
// OWNER > ADMIN > MEMBER
// Создание агентов: ADMIN+
// Приглашение: ADMIN+
// Удаление организации: OWNER only
// Чат с агентом: MEMBER+ (если accessMode = ALL_MEMBERS)
```

### Хранение ключей

- `nsApiKey` шифруется через `src/lib/crypto.ts` (AES-256-GCM) — как существующие API ключи
- Ключ не передаётся на фронтенд, используется только в серверных API routes

### Изоляция данных

- Namespace в AI Cortex гарантирует: организация A не видит данные организации B
- Все запросы к AI Cortex идут с `nskey_` конкретной организации
- McpServer привязан к OrgAgent → привязан к Organization → проверка через OrgMember

---

## 11. Лимиты (по тарифному плану)

Расширить модель `Plan` или `SystemSetting`:

| Лимит | Free | Pro | Business |
|-------|------|-----|----------|
| Организации | 1 | 3 | unlimited |
| Участников / орг | 3 | 20 | unlimited |
| Агентов / орг | 1 | 10 | unlimited |
| Файлов / агент | 5 | 50 | unlimited |
| Размер файла | 10 MB | 50 MB | 100 MB |
| Общий объём / орг | 50 MB | 1 GB | 10 GB |

---

## 12. Порядок реализации

### Фаза 1: Организации и участники (без AI-агентов)
1. Prisma-модели: Organization, OrgMember, OrgInvite
2. API: CRUD организаций, приглашения по email, принятие
3. Фронтенд: `/organizations`, `/organizations/[id]`, `/invite/[token]`
4. Email-шаблон приглашения

### Фаза 2: Агенты из документов
1. Prisma-модели: OrgAgent, OrgAgentFile, OrgAgentMember
2. Включить `AI_CORTEX_ENABLE_NAMESPACES=true`
3. API: создание агента → создание namespace (если первый агент) → создание проекта в AI Cortex
4. API: загрузка файлов (S3 + проксирование в AI Cortex)
5. API: process, progress (SSE proxy), publish
6. Создание McpServer при публикации
7. Фронтенд: `/organizations/[id]/agents/new`, прогресс-бар, статусы

### Фаза 3: Чат с агентами организации
1. Sidebar: секция "Организации" с агентами
2. При выборе агента → создание Conversation с привязкой к McpServer
3. route.ts: подгрузка MCP tools из OrgAgent.mcpServer
4. Проверка доступа: OrgMember + accessMode

### Фаза 4: Управление доступом
1. accessMode: ALL_MEMBERS / SPECIFIC → OrgAgentMember
2. UI: чекбоксы "кому доступен агент"
3. Инкрементальное обновление: загрузка новых файлов в существующего агента

---

## 13. Зависимости между проектами

```
Sanbao                          AI Cortex
───────                         ─────────
Organization → создаёт →       Namespace
OrgAgent     → создаёт →       Pipeline Project
OrgAgentFile → загружает →     Project files
"process"    → запускает →     Pipeline (extract→...→ready)
"publish"    → запускает →     Auto MCP endpoint
McpServer    ← получает URL ←  Published agent endpoint
route.ts     → вызывает →     MCP JSON-RPC (search, sql, graph)
```

**AI Cortex не нужно менять.** Вся архитектура namespace + pipeline + auto-publish уже реализована (Phase 6b, 529 тестов). Работа только на стороне Sanbao.
