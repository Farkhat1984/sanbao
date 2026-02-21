# FragmentDB (AI Cortex) — Интеграция и пользовательские базы знаний

> Архитектура интеграции Sanbao ↔ AI Cortex (FragmentDB v3 + Orchestrator)

## Обзор

**FragmentDB** (NexusCore) — AI-native vector-graph database (Rust). Сочетает семантический поиск (HNSW/DiskANN), полнотекстовый поиск (BM25), граф знаний и аналитику (DuckDB/FQL).

**AI Cortex Orchestrator** (v0.7.0) — Python MCP-сервер с двумя endpoint'ами:
- `/lawyer` — правовая база РК (18 кодексов, НПА, графы ссылок)
- `/broker` — таможня ЕАЭС (ТН ВЭД, расчёт пошлин, декларации)

### Текущая интеграция

```
Sanbao App
  ├── Agent: Юрист (system-femida-agent)
  │   └── MCP: http://orchestrator:8120/lawyer
  │       └── Tools: search, lookup, get_article, graph_traverse, list_domains
  ├── Agent: Брокер (system-broker-agent)
  │   └── MCP: http://orchestrator:8120/broker
  │       └── Tools: search, classify_goods, calculate_duties, get_required_docs, generate_declaration
  └── API: /api/articles → direct MCP call for article deep-linking
```

### Env-переменные

```env
LAWYER_MCP_URL=http://host.docker.internal:8120/lawyer
BROKER_MCP_URL=http://host.docker.internal:8120/broker
AI_CORTEX_AUTH_TOKEN=<bearer-token>
```

---

## Архитектура ночного обновления

```
┌─────────────────────────────────────────────────────────────┐
│                    Cron (00:00 daily)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Source Monitor         │
          │   Проверка изменений     │
          │   (hash comparison)      │
          └────────────┬────────────┘
                       │ changed docs
          ┌────────────▼────────────┐
          │   Diff Engine            │
          │   Определение изменённых │
          │   секций документа       │
          └────────────┬────────────┘
                       │ changed chunks
          ┌────────────▼────────────┐
          │   Re-processor           │
          │   - Re-chunk             │
          │   - Re-embed             │
          │   - Update index         │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Notifier               │
          │   - Admin alert on fail  │
          │   - User email on update │
          │   - Metrics logging      │
          └─────────────────────────┘
```

### Компоненты

#### 1. Source Monitor
- Отслеживает `updatedAt` у `KnowledgeDocument`
- Сравнивает хеш контента (`contentHash` SHA-256) с предыдущим
- Результат: список документов с изменениями

#### 2. Diff Engine
- Для изменённых документов: пере-чанкование только изменённых секций
- Стратегия: chunk overlap 50 токенов, размер чанка 500-1000 токенов
- Если изменение затрагивает > 50% документа — полная пере-индексация

#### 3. Re-processor
- Генерация embeddings через OpenAI `text-embedding-3-small` (или local model)
- Batch processing: до 100 чанков за один API-вызов
- Upsert в FragmentDB: обновление существующих, добавление новых, удаление устаревших

#### 4. Notifier
- Telegram/email алерт при ошибках обработки
- Email пользователю при завершении обновления его базы знаний
- Prometheus метрики: время обработки, количество обновлённых документов, ошибки

---

## Модель данных Sanbao

```prisma
model KnowledgeBase {
  id          String  @id @default(cuid())
  userId      String
  name        String
  description String?
  status      String  @default("ACTIVE")  // ACTIVE | PROCESSING | ERROR
  docCount    Int     @default(0)
  chunkCount  Int     @default(0)
  totalSizeBytes Int  @default(0)

  user      User                @relation(fields: [userId], references: [id])
  documents KnowledgeDocument[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

model KnowledgeDocument {
  id              String  @id @default(cuid())
  knowledgeBaseId String
  fileName        String
  contentHash     String? // SHA-256 для отслеживания изменений
  status          String  @default("PENDING") // PENDING | PROCESSING | READY | ERROR
  chunkCount      Int     @default(0)
  sizeBytes       Int     @default(0)
  errorMessage    String?
  lastProcessedAt DateTime?

  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([knowledgeBaseId])
  @@index([status])
}
```

---

## Интеграция с Sanbao

### API endpoints

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/knowledge` | GET | Список баз знаний пользователя |
| `/api/knowledge` | POST | Создать базу знаний |
| `/api/knowledge/[id]` | GET | Детали базы знаний |
| `/api/knowledge/[id]` | DELETE | Удалить базу |
| `/api/knowledge/[id]/upload` | POST | Загрузить документ |
| `/api/knowledge/[id]/documents` | GET | Список документов |
| `/api/knowledge/webhook` | POST | Callback от FragmentDB (обновление статуса) |
| `/api/knowledge/health` | GET | Проверка связи с FragmentDB |

### Native tool: `search_user_knowledge`

```typescript
registerNativeTool({
  name: "search_user_knowledge",
  description: "Семантический поиск по базам знаний пользователя",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Поисковый запрос" },
      knowledgeBaseId: { type: "string", description: "ID конкретной базы (опционально)" },
      topK: { type: "number", description: "Количество результатов (по умолчанию 5)" },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    // Call FragmentDB API with user namespace
    // Return top-K fragments with source info
  },
});
```

### System prompt injection

```
--- БАЗЫ ЗНАНИЙ ПОЛЬЗОВАТЕЛЯ ---
У пользователя есть базы знаний с семантическим поиском:
- "Законодательство РК" — 45 документов, 1200 фрагментов
- "Внутренние регламенты" — 12 документов, 340 фрагментов
Используй search_user_knowledge когда вопрос может быть связан с этими темами.
--- КОНЕЦ БАЗ ЗНАНИЙ ---
```

---

## Per-User бизнес-модель

### Квоты (привязка к Plan)

| План | Макс. баз | Макс. документов | Макс. размер | Запросы/день |
|------|-----------|-----------------|--------------|--------------|
| Free | 1 | 5 | 10 MB | 20 |
| Pro | 5 | 50 | 100 MB | 200 |
| Business | 20 | 500 | 1 GB | Unlimited |

### Тарификация (опционально)
- Per-document: обработка + хранение
- Per-query: каждый семантический поиск
- Комбинированная: месячная подписка + pay-per-use сверх квоты

---

## Конфигурация AI Cortex

### Sanbao → Orchestrator (MCP)

```env
LAWYER_MCP_URL=http://host.docker.internal:8120/lawyer
BROKER_MCP_URL=http://host.docker.internal:8120/broker
AI_CORTEX_AUTH_TOKEN=<bearer-token>
```

### Orchestrator → FragmentDB

```env
FRAGMENTDB_URL=http://fragmentdb:8080      # REST API v3
AI_CORTEX_PORT=8120                         # Orchestrator port
AI_CORTEX_AUTH_TOKEN=<bearer-token>         # MCP auth
DEEPINFRA_API_KEY=<key>                     # Embedding service
```

### Docker Compose (failover)

```yaml
fragmentdb:   # Rust server, port 8080 → host 8110
  build: ../ai_cortex

orchestrator: # Python MCP, port 8120
  build: deploy/Dockerfile.orchestrator
  depends_on: [fragmentdb, embedding-proxy]
```

---

## Домены (AI Cortex Orchestrator)

| Домен | Тип | Коллекция | Назначение |
|-------|-----|-----------|------------|
| `legal_kz` | text | `legal_code_kz` | 18 кодексов РК |
| `legal_ref_kz` | table | — | Правовые справочники (МРП, МЗП) |
| `tnved` | mixed | `tnved_rates` | ТН ВЭД ЕАЭС (13 279 кодов) |
| `sop` | text | `company_sops` | СОП компании |
| `snip` | text | `construction_norms` | Строительные нормы |
| `generic` | text | `documents` | Произвольные документы |

---

## Мониторинг

| Метрика | Описание |
|---------|----------|
| `GET /health` (orchestrator:8120) | Статус оркестратора |
| `GET /health` (fragmentdb:8080) | Статус FragmentDB |
| `GET /metrics` (fragmentdb:8080) | Prometheus метрики (QPS, latency) |

---

## Roadmap (пользовательские базы знаний)

1. **Phase 1** — Базовая интеграция: MCP agents (Юрист + Брокер) ✅
2. **Phase 2** — Per-user knowledge bases: upload → chunk → embed → search
3. **Phase 3** — Per-user квоты и биллинг (Plan.maxStorageMb)
4. **Phase 4** — UI: страница /knowledge с drag-n-drop загрузкой
5. **Phase 5** — Мониторинг и алертинг

---

## Зависимости

- **AI Cortex** — FragmentDB Rust server + Python orchestrator (`/home/metadmin/faragj/ai_cortex/`)
- **Embedding** — DeepInfra Qwen3-Embedding-8B (dimension: 4096)
- **Docker** — `docker-compose.failover.yml` запускает fragmentdb + orchestrator + embedding-proxy
