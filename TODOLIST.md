# TODOLIST: AI Cortex — Качество и пайплайны

**Дата:** 2026-02-27
**Источник:** E2E тестирование всех 4 агентов

---

## P0 — Критично

### 1. Юрист: статус закона "утратил силу" не реализован
**Проблема:** `get_law` возвращает только `"new"` и `"updated"`. Законы, утратившие силу (напр. старый "О банках" Z950002444_, заменён Z2600000258 в 2026), показывают `"updated"` вместо `"expired"`. Нет статуса "в силе" / "утратил силу".
**Где:** `ai_cortex/scripts/ingestion/ingest_adilet.py` (парсинг), `ai_cortex/orchestrator/mcp_server.py` (_handle_get_law)
**Решение:**
- [ ] 1.1 Проверить существующую реализацию (типы Z, V, U — уже есть парсинг?)
- [ ] 1.2 Парсить статус с adilet.zan.kz при ингесте (тег `<status>` или текст "Утратил силу")
- [ ] 1.3 Добавить metadata field `status` со значениями: `active` / `updated` / `expired` / `suspended`
- [ ] 1.4 Re-ingest laws_kz с обновлённым парсером (или enrichment скрипт по существующим)
- [ ] 1.5 В get_law ответе показывать русский статус: "В силе", "С изменениями", "Утратил силу"
- [ ] 1.6 В search results по laws_kz включать статус в snippet

### 2. Юрист: graph_traverse пуст
**Проблема:** `graph_traverse` всегда возвращает `{nodes: [], count: 0}` — граф cross-references не построен для legal_kz.
**Где:** `ai_cortex/orchestrator/search/graph_builder.py`, `ai_cortex/orchestrator/domains/legal_kz.py`
**Решение:**
- [ ] 2.1 Проверить `graph_edge_types` в конфиге legal_kz (сейчас пусто?)
- [ ] 2.2 Реализовать парсинг ссылок между статьями ("см. статью X", "в соответствии со статьёй Y")
- [ ] 2.3 Построить граф и пересобрать оркестратор

---

## P1 — Важно

### 3. Юрист: lookup не фильтрует по code
**Проблема:** `lookup(key="article_number", value="188", code="criminal_code")` возвращает ст. 188 из ВСЕХ кодексов, игнорируя фильтр `code`.
**Где:** `ai_cortex/orchestrator/mcp_server.py` (_handle_lookup)
**Решение:**
- [ ] 3.1 Добавить фильтрацию по metadata `code` в lookup
- [ ] 3.2 Тест: lookup article 188 + code=criminal_code → только УК

### 4. Юрист: search relevance — ключевые статьи
**Проблема:** Поиск "увольнение работника" не возвращает ст.52 ТК (основная статья). "алименты" не возвращает семейный кодекс.
**Где:** `ai_cortex/orchestrator/domains/legal_kz.py` (synonyms, weights)
**Решение:**
- [ ] 4.1 Расширить синонимы: увольнение→расторжение, алименты→содержание
- [ ] 4.2 Увеличить BM25 weight для legal_kz (сейчас default?)
- [ ] 4.3 Тест top-5 relevance для 10 ключевых запросов

---

## P2 — Улучшения

### 5. platform_1c BM25 timeout при старте
**Проблема:** 39K docs → BM25 rebuild таймаутит (>60s на каждую попытку), вызывает рестарты контейнера.
**Статус:** Workaround — переставили tnved/laws_kz перед platform_1c в FRAGMENTDB_DOMAINS.
**Решение:**
- [ ] 5.1 Увеличить timeout для BM25 rebuild до 300s
- [ ] 5.2 Или pre-build BM25 index при ингесте (persist to disk)

### 6. laws_kz: пустой статус для P/V типов документов
**Проблема:** Постановления (P) и ведомственные акты (V) имеют пустой `status`, `date`, `issuer`.
**Где:** `ai_cortex/scripts/ingestion/ingest_adilet.py`
**Решение:**
- [ ] 6.1 Enrichment скрипт: парсить метаданные из adilet для P/V типов

---

## Завершено (2026-02-27)

| # | Задача | Что сделано |
|---|--------|------------|
| ~~3~~ | ~~NL→SQL fuzzy matching~~ | Обновлён промпт: ILIKE, keyword split, fuzzy stems. "проводка зарплата" → 6 записей |
| ~~4~~ | ~~classify_goods EN→RU~~ | Добавлен LLM-перевод `_translate_to_russian()`. "iPhone" → 8517130000 (смартфоны) #1 |
| ~~9~~ | ~~NL→SQL текущий год~~ | Добавлен `current_year` в промпт LLM |
| ~~—~~ | ~~Broker sql_query~~ | Добавлен `tool_domains: {sql_query: tnved}`, COPY tnved data в Docker |
| ~~—~~ | ~~get_required_docs → DuckDB~~ | required_docs.csv (276 строк) → DuckDB, fallback на hardcoded |
| ~~—~~ | ~~generate_declaration PDF~~ | reportlab==4.* добавлен в Dockerfile |
| ~~—~~ | ~~FRAGMENTDB_DOMAINS order~~ | tnved/laws_kz перед platform_1c (workaround timeout) |

---

## Прогресс

| # | Задача | Приоритет | Статус |
|---|--------|-----------|--------|
| 1 | Статус "утратил силу" | P0 | TODO |
| 2 | graph_traverse граф | P0 | TODO |
| 3 | lookup фильтр по code | P1 | TODO |
| 4 | Search relevance | P1 | TODO |
| 5 | platform_1c timeout | P2 | Workaround |
| 6 | P/V type metadata | P2 | TODO |
