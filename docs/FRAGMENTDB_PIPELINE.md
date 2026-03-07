# FragmentDB (AI Cortex) — Интеграция и пользовательские базы знаний

> Архитектура интеграции Sanbao ↔ AI Cortex (FragmentDB v4 + Orchestrator v0.8.0)

## Обзор

**FragmentDB** (FragmentDB v0.5.0) — AI-native vector-graph database (Rust). Сочетает семантический поиск (HNSW/DiskANN), полнотекстовый поиск (BM25), граф знаний и аналитику (DuckDB/FQL).

**AI Cortex Orchestrator** (v0.8.0) — Python MCP-сервер (aiohttp) с 4 endpoint'ами:
- `POST /lawyer` — правовая база РК (18 кодексов + ~199K законов, графы ссылок, sql_query → legal_ref_kz)
- `POST /broker` — таможня ЕАЭС (ТН ВЭД 13K кодов, расчёт пошлин, декларации ДТ1)
- `POST /accountant` — бухгалтерия 1С для Казахстана (~20.7K чанков + sql_query → 6 DuckDB-таблиц)
- `POST /consultant_1c` — платформа 1С (~39K чанков, BSP, EDT, ERP, Розница)
- `GET /health` — liveness probe (version, endpoints, agents, tool_count)

### Текущая интеграция

```
Sanbao App
  ├── Agent: Юрист (system-femida-agent)
  │   └── MCP: /lawyer
  │       └── Tools (7): search, get_article, get_law, lookup, graph_traverse, list_domains, get_exchange_rate
  ├── Agent: Таможенный брокер (system-broker-agent)
  │   └── MCP: /broker
  │       └── Tools (8): search, sql_query, classify_goods, calculate_duties,
  │                       get_required_docs, list_domains, generate_declaration, get_exchange_rate
  ├── Agent: Бухгалтер (system-accountant-agent)
  │   └── MCP: /accountant + /lawyer + /consultant_1c
  │       └── Tools: search, get_1c_article, sql_query, list_domains, get_exchange_rate + lawyer tools
  ├── Agent: 1С Ассистент (system-1c-assistant-agent)
  │   └── MCP: /consultant_1c
  │       └── Tools (4): search, get_1c_article, list_domains, get_exchange_rate
  └── API: /api/articles → direct MCP calls for article:// deep-linking
```

### Env-переменные

```env
LAWYER_MCP_URL=http://orchestrator:8120/lawyer
BROKER_MCP_URL=http://orchestrator:8120/broker
ACCOUNTINGDB_MCP_URL=http://orchestrator:8120/accountant
CONSULTANT_1C_MCP_URL=http://orchestrator:8120/consultant_1c
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
LAWYER_MCP_URL=http://orchestrator:8120/lawyer
BROKER_MCP_URL=http://orchestrator:8120/broker
AI_CORTEX_AUTH_TOKEN=<bearer-token>
```

### Orchestrator → FragmentDB

```env
FRAGMENTDB_URL=http://fragmentdb:8080      # REST API v3
AI_CORTEX_PORT=8120                         # Orchestrator port
AI_CORTEX_AUTH_TOKEN=<bearer-token>         # MCP auth
MOONSHOT_API_KEY=<key>                      # LLM for NL-to-SQL (Kimi K2.5, primary)
DEEPINFRA_API_KEY=<key>                     # Embedding service + LLM fallback
FRAGMENTDB_DOMAINS=legal_ref_kz,accounting_ref_kz,legal_kz,accounting_1c,platform_1c,tnved,laws_kz
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

| Домен | Тип | Коллекция | Документов | Назначение |
|-------|-----|-----------|-----------|------------|
| `legal_kz` | text | `legal_kz` | 7,463 статей | 18 кодексов РК (УК, ГК, НК, ТК, КоАП и др.) |
| `laws_kz` | text | `laws_kz` | ~199K законов | НПА РК (законы, указы, постановления) |
| `legal_ref_kz` | table | — | — | Правовые справочники (МРП, МЗП, курсы валют) |
| `accounting_ref_kz` | table | — | 6 таблиц | Бухгалтерские справочники (ставки, ТПС, проводки, амортизация, ФНО) |
| `tnved` | mixed | `tnved_rates` | 13,279 кодов | ТН ВЭД ЕАЭС (пошлины, НДС, акцизы, DuckDB: duty_rates + required_docs) |
| `accounting_1c` | text | `accounting_1c` | ~20.7K чанков | 1С Бухгалтерия для КЗ (ITS + PRO1C, зарплата, кадры) |
| `platform_1c` | text | `platform_1c` | ~39K чанков | Платформа 1С (BSP, EDT, ERP, Розница, документация) |
| `sop` | text | `company_sops` | — | СОП компании (пусто) |
| `snip` | text | `construction_norms` | — | Строительные нормы (пусто) |
| `generic` | text | `documents` | — | Произвольные документы |
| `sales` | table | — | — | Данные продаж (пример) |

### Источники данных

| Коллекция | Источник | Скрипт загрузки |
|-----------|----------|-----------------|
| `legal_kz` | `data/legal_codes/*.txt` (17 кодексов, 30MB) | `scripts/ingestion/ingest_all_codes.py` |
| `laws_kz` | `data/adilet/` (~173K НПА) | `scripts/ingestion/ingest_adilet.py` |
| `tnved_rates` | `data/tnved/tnved_rates.json` (13K записей) | `scripts/ingestion/ingest_tnved.py` |
| `accounting_1c` | `data/1c_knowledge/raw/{its,pro1c}/` (37K файлов) | `scripts/ingestion/ingest_1c.py --target accounting` |
| `platform_1c` | `data/1c_knowledge/raw/{its,pro1c}/` (37K файлов) | `scripts/ingestion/ingest_1c.py --target platform` |
| `accounting_ref_kz` | `data/accounting_ref_kz/*.csv` (5 CSV) + `data/legal_reference_kz.csv` | CSV → DuckDB in-memory (автозагрузка) |

### Эмбеддинги

- **Модель:** Qwen/Qwen3-Embedding-8B (DeepInfra API)
- **Размерность:** 4096
- **Кэш:** SQLite (`data/cache/embedding_cache.db`, ~223K эмбеддингов, 16GB)
- **Коллекции с эмбеддингами:** tnved_rates, accounting_1c, platform_1c
- **BM25-only коллекции:** legal_kz, laws_kz (не требуют эмбеддингов)

### MCP-инструменты по endpoint'ам

**Lawyer (7 tools):**

| Инструмент | Описание |
|------------|----------|
| `search` | Семантический + BM25 гибридный поиск по правовым доменам |
| `get_article` | Полный текст статьи кодекса по коду и номеру |
| `get_law` | Полный текст закона/НПА по doc_code (из laws_kz) |
| `lookup` | Точный поиск по ключевому полю (номер статьи, раздел) |
| `graph_traverse` | Обход графа знаний от документа (BFS, cross-references) |
| `list_domains` | Список доступных правовых доменов |
| `get_exchange_rate` | Курсы валют НБ РК на дату |

**Broker (8 tools):**

| Инструмент | Описание |
|------------|----------|
| `search` | Семантический + BM25 поиск по кодам ТН ВЭД (domain=tnved) |
| `sql_query` | NL→SQL→DuckDB по 2 таблицам (duty_rates, required_docs) → domain: tnved |
| `classify_goods` | Классификация товара → top-5 кодов с иерархией и документами |
| `calculate_duties` | Расчёт пошлин (ad valorem/specific/combined) + НДС 12% + акциз |
| `get_required_docs` | Необходимые документы по коду (14 типов, DuckDB `required_docs` → fallback hardcoded) |
| `list_domains` | Список доступных таможенных доменов |
| `generate_declaration` | PDF декларации ДТ1 (54 графы, Решение КТС №257, reportlab) |
| `get_exchange_rate` | Курсы валют НБ РК на дату |

**Accountant (5 tools):**

| Инструмент | Описание |
|------------|----------|
| `search` | Поиск по базе знаний 1С Бухгалтерии (ITS + PRO1C) → domain: accounting_1c |
| `get_1c_article` | Полный текст статьи 1С по article_id (с картинками) |
| `sql_query` | NL→SQL→DuckDB по 6 справочным таблицам → domain: accounting_ref_kz |
| `list_domains` | Список доступных доменов |
| `get_exchange_rate` | Курсы валют НБ РК на дату |

`sql_query` таблицы (DuckDB in-memory):

| Таблица | Строк | Содержимое |
|---------|-------|------------|
| `tax_rates` | ~60 | Ставки налогов/взносов по годам (ИПН, КПН, НДС, ОПВ, ОПВР, ВОСМС, СО, СН) |
| `chart_of_accounts` | ~150 | Типовой план счетов РК (1010-7710) |
| `journal_templates` | ~80 | Типовые проводки: зарплата, покупки, продажи, ОС, амортизация, налоги |
| `depreciation_groups` | ~15 | Группы ОС + нормы амортизации (ст. 271 НК РК) |
| `tax_calendar` | ~25 | Сроки сдачи ФНО (100, 200, 300, 910 и др.) |
| `legal_params` | ~40 | МРП, МЗП, ПМ, БВ, МП, БПВ по годам |

**Consultant 1C (4 tools):**

| Инструмент | Описание |
|------------|----------|
| `search` | Поиск по документации платформы 1С (BSP, EDT, ERP, Розница) |
| `get_1c_article` | Полный текст статьи 1С по article_id (с картинками) |
| `list_domains` | Список доступных доменов |
| `get_exchange_rate` | Курсы валют НБ РК на дату |

---

## Мониторинг

| Метрика | Описание |
|---------|----------|
| `GET /health` (orchestrator:8120) | Статус оркестратора + версия + список endpoints |
| `GET /health` (fragmentdb:8080) | Статус FragmentDB |
| `GET /metrics` (fragmentdb:8080) | Prometheus метрики (QPS, latency) |

### Производительность (2x Xeon E5-2695 v4, ~280K документов)

| Операция | p50 | p99 | MCP tool |
|----------|-----|-----|----------|
| BM25 search | 6 ms | 31 ms | `search` |
| Document read | 1 ms | 27 ms | `get_article` |
| Metadata scan | 88 ms | 138 ms | `lookup` |
| 1C article (full) | 50 ms | 500 ms | `get_1c_article` |
| Law (full text) | 100 ms | 2s | `get_law` |

---

## article:// Deep Linking Protocol

AI-ответы содержат ссылки `article://` — при клике открывается полный текст в UnifiedPanel.

### Форматы

```
[ст. 188 УК РК](article://criminal_code/188)          → /api/articles → /lawyer get_article
[Закон о защите](article://law/Z000000072_)            → /api/articles → /lawyer get_law
[Начисление зарплаты](article://1c_buh/{article_id})   → /api/articles → /accountant get_1c_article
[Настройка обмена](article://1c/{article_id})          → /api/articles → /consultant_1c get_1c_article
```

### Компоненты

- `src/components/chat/ArticleLink.tsx` — кликабельная кнопка § / 📖
- `src/components/panel/ArticleContentView.tsx` — рендер в панели (markdown для 1С с картинками)
- `src/stores/articleStore.ts` — LRU-кэш, загрузка через /api/articles
- `src/app/api/articles/route.ts` — маршрутизация по code type → MCP tool

---

## Roadmap (пользовательские базы знаний)

1. **Phase 1** — Базовая интеграция: 4 MCP agents (Юрист + Брокер + Бухгалтер + 1С Ассистент) ✅
2. **Phase 1.5** — Полная загрузка данных: 5 коллекций (legal_kz, laws_kz, tnved_rates, accounting_1c, platform_1c) ✅
3. **Phase 1.6** — DuckDB-backed sql_query для Бухгалтера (6 таблиц: ставки, ТПС, проводки, амортизация, ФНО, МРП) + per-tool domain routing ✅
4. **Phase 1.7** — DuckDB-backed sql_query для Брокера (duty_rates + required_docs), dehardcoded _GROUP_TO_DOCS → CSV, reportlab для generate_declaration ✅
5. **Phase 2** — Per-user knowledge bases: upload → chunk → embed → search
4. **Phase 3** — Per-user квоты и биллинг (Plan.maxStorageMb)
5. **Phase 4** — UI: страница /knowledge с drag-n-drop загрузкой
6. **Phase 5** — Мониторинг и алертинг

---

## Зависимости

- **AI Cortex** — FragmentDB Rust server + Python orchestrator (`/home/metadmin/faragj/ai_cortex/`)
- **Embedding** — DeepInfra Qwen3-Embedding-8B (dimension: 4096)
- **Docker** — `docker-compose.prod.yml` запускает fragmentdb + orchestrator + embedding-proxy
- **Ingestion scripts** — `ai_cortex/scripts/ingestion/` (ingest_all_codes.py, ingest_1c.py, ingest_tnved.py, ingest_adilet.py)
