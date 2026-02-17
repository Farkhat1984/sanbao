# FragmentDB — Пайплайн автообновления и пользовательские базы знаний

> Архитектура ночного обновления данных и per-user knowledge bases для Sanbao

## Обзор

FragmentDB — сервис семантического поиска по фрагментам документов. Каждый документ разбивается на чанки, для каждого генерируется embedding, и хранится в векторном индексе с метаданными.

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

## Конфигурация FragmentDB

```env
FRAGMENTDB_URL=http://fragmentdb:8080
FRAGMENTDB_API_KEY=...
FRAGMENTDB_WEBHOOK_SECRET=...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BATCH_SIZE=100
CHUNK_SIZE=800
CHUNK_OVERLAP=100
```

---

## Мониторинг

| Метрика | Описание |
|---------|----------|
| `fragmentdb_pipeline_duration_seconds` | Время полного обновления |
| `fragmentdb_documents_processed_total` | Обработанные документы |
| `fragmentdb_chunks_updated_total` | Обновлённые фрагменты |
| `fragmentdb_errors_total` | Ошибки обработки |
| `fragmentdb_search_latency_seconds` | Задержка поиска |
| `fragmentdb_storage_bytes` | Использованное хранилище |

---

## Roadmap

1. **Phase 1** — Базовая интеграция: upload → chunk → embed → search (1 неделя)
2. **Phase 2** — Ночной пайплайн с diff engine (3-5 дней)
3. **Phase 3** — Per-user квоты и биллинг (3 дня)
4. **Phase 4** — UI: страница /knowledge с drag-n-drop загрузкой (3-5 дней)
5. **Phase 5** — Мониторинг и алертинг (2 дня)

---

## Зависимости

- **FragmentDB service** — Docker container или external API
- **Embedding model** — OpenAI API или local (sentence-transformers)
- **Sanbao C3** — AI Cortex implementation (базовая интеграция)
