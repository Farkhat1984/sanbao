# Контекстная реклама в AI-ассистенте Sanbao

> Концепция монетизации через нативную рекламу в AI-ответах

## Обзор индустрии

| Компания | Подход | Статус |
|----------|--------|--------|
| Google | Sponsored results в AI Overviews | Активно |
| Microsoft | Реклама в Copilot ответах | Тестирование |
| Perplexity | Sponsored follow-up вопросы | Бета |
| Meta | Рекламные карточки в AI-чате | Планирование |

**Ключевой принцип:** реклама должна быть релевантной, чётко маркированной, не вводящей в заблуждение.

---

## Типы рекламы

### 1. Контекстная рекомендация (Primary)
- Карточка «Возможно вас заинтересует» после релевантного ответа
- Пример: пользователь спрашивает о ремонте — карточка строительного магазина
- Формат: иконка + заголовок + 1 строка описания + CTA кнопка

### 2. Спонсированное знание (Secondary)
- Брендированный контент в результатах поиска знаний (маркировка «Реклама»)
- Пример: вопрос о CRM — в результатах «Bitrix24: возможности для бизнеса»
- Формат: как обычный результат + метка «Реклама»

### 3. Спонсированные подсказки (Tertiary)
- Предлагаемые follow-up вопросы от рекламодателей
- Пример: после ответа о налогах — «Узнать о налоговом консалтинге от [Бренд]?»
- Формат: кнопка-чип с меткой «Спонсор»

### 4. Баннер в боковой панели (Minimal)
- Визуальная реклама в sidebar или панели
- Наименее навязчивый формат — не вмешивается в AI-диалог
- Формат: изображение 300x250 или текстовый блок

---

## Пайплайн выбора рекламы

```
Сообщение пользователя
  → Извлечение интента/темы (keywords + категория)
  → Сопоставление с активными кампаниями (targeting)
  → Оценка релевантности (score 0-1)
  → Если score > 0.6: вставка в ответ
  → Маркировка как «Реклама»
  → Трекинг показа/клика
```

### Targeting параметры

| Параметр | Описание |
|----------|----------|
| `topics[]` | Тематические теги (право, финансы, IT, здоровье) |
| `keywords[]` | Ключевые слова в сообщении |
| `locale` | Язык пользователя (ru, kk) |
| `planType` | Тарифный план (Free — показывать, Pro — реже, Business — нет) |
| `timeOfDay` | Утро/день/вечер |
| `userSegment` | Сегмент пользователя (новый, активный, бизнес) |

---

## Модель данных

```prisma
model AdCampaign {
  id            String      @id @default(cuid())
  advertiserId  String
  name          String
  budgetTotal   Int         // в тиынах
  budgetSpent   Int         @default(0)
  costPerClick  Int         // CPC в тиынах
  costPerView   Int         // CPM/1000 в тиынах
  status        String      @default("DRAFT") // DRAFT | ACTIVE | PAUSED | COMPLETED
  targeting     Json        // { topics, keywords, locale, planType, timeOfDay }
  startDate     DateTime?
  endDate       DateTime?
  creatives     AdCreative[]
  impressions   AdImpression[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model AdCreative {
  id          String      @id @default(cuid())
  campaignId  String
  type        String      // recommendation | knowledge | suggestion | banner
  title       String
  description String?
  ctaText     String?     // Текст кнопки CTA
  ctaUrl      String?
  imageUrl    String?
  isActive    Boolean     @default(true)
  campaign    AdCampaign  @relation(fields: [campaignId], references: [id])
  impressions AdImpression[]
}

model AdImpression {
  id             String      @id @default(cuid())
  creativeId     String
  campaignId     String
  userId         String
  conversationId String?
  shown          Boolean     @default(true)
  clicked        Boolean     @default(false)
  creative       AdCreative  @relation(fields: [creativeId], references: [id])
  campaign       AdCampaign  @relation(fields: [campaignId], references: [id])
  createdAt      DateTime    @default(now())
}
```

---

## Правила этики и UX

1. **Всегда маркировать** — текст «Реклама» / «Спонсор» обязателен
2. **Не изменять факты** — AI-ответ никогда не модифицируется рекламой
3. **Максимум 1 реклама** — на один ход диалога
4. **Отключение для Premium** — Business план = без рекламы
5. **Запрет на чувствительные темы** — здоровье, юридические советы, финансовые рекомендации
6. **Частотный лимит** — максимум 1 реклама на 5 сообщений
7. **Прозрачность** — пользователь может нажать «Почему я вижу эту рекламу?»

---

## Минимальный прототип (Phase 1)

### Компоненты:
- `src/lib/ad-matcher.ts` — keyword matching, 5-10 hardcoded тестовых объявлений
- `src/components/chat/AdCard.tsx` — карточка рекламы под AI-ответом
- Админ: toggle «Показывать рекламу» в SystemSetting

### Тестовые объявления:
1. Юридическая консультация → тема: право, налоги
2. CRM система → тема: бизнес, продажи
3. Курсы программирования → тема: IT, разработка
4. Бухгалтерский сервис → тема: бухгалтерия, отчётность
5. Маркетплейс услуг → тема: фриланс, работа

---

## Метрики

| Метрика | Описание |
|---------|----------|
| CTR | Клики / Показы |
| RPM | Доход на 1000 показов |
| Fill Rate | % запросов с показанной рекламой |
| Relevance Score | Средняя оценка релевантности |
| User Satisfaction | NPS до/после включения рекламы |

---

## Roadmap

1. **Phase 1** — Прототип с hardcoded объявлениями (1-2 дня)
2. **Phase 2** — Админ-панель управления кампаниями (3-5 дней)
3. **Phase 3** — Рекламодательский кабинет + биллинг (2 недели)
4. **Phase 4** — ML-based targeting + A/B тесты (1 месяц)
