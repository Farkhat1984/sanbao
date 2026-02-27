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

## Данные — Обогащение и ингест

### 7. Enrichment: добавить V-тип в обогащение
**Проблема:** `adilet_enrich_loop.sh` запущен с `--types Z,U,P,H,S` — **V (121,785 приказов) пропущен**. V-файлы скачаны, заингестированы в laws_kz, но без metadata (status/date/number/issuer).
**Где:** `ai_cortex/scripts/scraping/adilet_enrich_loop.sh`
**Решение:**
- [ ] 7.1 Добавить V в `--types Z,U,P,V,H,S` в loop-скрипте
- [ ] 7.2 Перезапустить enrichment loop
- [ ] 7.3 После обогащения — re-ingest V-документы с metadata

### 8. Ингест H-документов (7,807 норм. постановлений)
**Проблема:** H (нормативные постановления) скачаны (7,807 файлов, 395 MB), но **не заингестированы** в laws_kz. Default types в `ingest_adilet.py`: Z,U,P,V — H отсутствует.
**Где:** `ai_cortex/scripts/ingestion/ingest_adilet.py`
**Решение:**
- [ ] 8.1 Сначала обогатить H-документы (enrichment loop уже включает H)
- [ ] 8.2 Запустить `ingest_adilet.py --types H --resume` (нужен FragmentDB + DEEPINFRA_API_KEY)
- [ ] 8.3 Проверить laws_kz collection size после ингеста

### 9. Доскачать 813 failed V-документов
**Проблема:** Из 122,598 URL типа V скачано 121,785. Осталось **813 failed** (все с 1 попыткой).
**Где:** `ai_cortex/data/adilet/cache/crawl_state.json` (failed dict)
**Решение:**
- [ ] 9.1 Сбросить failed count в crawl_state.json (все = 1 попытка, лимит = 3)
- [ ] 9.2 Запустить `adilet_scraper.py --resume` — подхватит только failed
- [ ] 9.3 После скачивания — обогатить + заингестировать

### 10. P-обогащение неполное (1,164 из 34,803)
**Проблема:** Только 1,164 постановлений обогащены из 34,803. Остальные без date/number/status.
**Статус:** IN PROGRESS — enrichment loop обрабатывает P в текущем ране.
**Решение:**
- [ ] 10.1 Дождаться завершения enrichment loop (ETA ~6ч для всех типов)
- [ ] 10.2 После обогащения — re-ingest P-документы с обновлёнными metadata

### 11. Удалить nexuscore_data_testcopy (389 MB)
**Проблема:** Старый бэкап БД с Hnsw-индексом (до миграции на MmapHnsw). Не используется.
**Где:** `ai_cortex/nexuscore_data_testcopy/`
**Решение:**
- [ ] 11.1 Удалить `rm -rf nexuscore_data_testcopy/`

---

## Инвентаризация данных (2026-02-27)

### Сырые данные (data/) — 30 GB

| Датасет | Файлов | Размер | Обогащено | Заингестировано |
|---------|--------|--------|-----------|-----------------|
| Adilet Z (законы) | 3,519 | 279 MB | 3,519 (100%) | laws_kz |
| Adilet U (указы) | 4,228 | 102 MB | 4,228 (100%) | laws_kz |
| Adilet P (постановления) | 34,803 | 1.2 GB | 1,164 (3%) | laws_kz |
| Adilet V (приказы) | 121,785 | 5.2 GB | 0 (0%) | laws_kz |
| Adilet H (норм. постан.) | 7,807 | 395 MB | 0 (0%) | **НЕТ** |
| Adilet S (конст. законы) | 270 | 7.9 MB | 0 (0%) | laws_kz |
| 1C ITS | 33,868 | 4.4 GB | — | platform_1c + accounting_1c |
| 1C PRO1C | 3,399 | 58 MB | — | accounting_1c |
| TNVED | 13,279 | 24 MB | — | tnved_rates |
| Правовые кодексы | 7,737 ст. | 62 MB | — | legal_kz + legal_code_kz |
| Бух. справочник | 241 строка | 52 KB | — | DuckDB in-memory |
| Правовой справочник | 18 строк | 1.2 KB | — | DuckDB in-memory |
| Embedding кеш | 242,709 | 17 GB | — | — |

### FragmentDB (nexuscore_data/) — 15 GB

| Коллекция | Dim | Доки (chunks) | Размер |
|-----------|-----|---------------|--------|
| laws_kz | 4096 | ~340K | 8.6 GB |
| platform_1c | 4096 | ~200K | 3.8 GB |
| accounting_1c | 4096 | ~58K | 1.1 GB |
| tnved_rates | 4096 | 13,279 | 448 MB |
| legal_kz | 4096 | ~9,200 | 266 MB |
| legal_code_kz | 4096 | ~7,737 | 177 MB |

---

## Прогресс

| # | Задача | Приоритет | Статус |
|---|--------|-----------|--------|
| 1 | Статус "утратил силу" | P0 | IN PROGRESS (enrichment запущен, парсинг есть) |
| 2 | graph_traverse граф | P0 | TODO |
| 3 | lookup фильтр по code | P1 | TODO |
| 4 | Search relevance | P1 | TODO |
| 5 | platform_1c timeout | P2 | Workaround |
| 6 | P/V type metadata | P2 | IN PROGRESS (= задача #7+#10) |
| 7 | V-тип в enrichment | P1 | TODO |
| 8 | Ингест H-документов | P1 | TODO (после enrichment) |
| 9 | Доскачать 813 failed V | P2 | TODO |
| 10 | P-обогащение | P1 | IN PROGRESS |
| 11 | Удалить testcopy | P2 | TODO |
