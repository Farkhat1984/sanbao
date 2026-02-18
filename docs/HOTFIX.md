# HOTFIX.md — Задачи на исправление

## Статус: ВЫПОЛНЕНО (1-3, 5), ОТЛОЖЕНО (4)

---

## 1. Убрать хардкод моделей — использовать только API из админки
**Статус:** DONE

### Что сделано
- Удалены `DEFAULT_TEXT_MODEL`, `DEFAULT_IMAGE_MODEL`, `DEFAULT_IMAGE_EDIT_MODEL`, `MOONSHOT_BASE_URL`, `MOONSHOT_CHAT_URL`, `DEEPINFRA_BASE_URL` из `constants.ts`
- Удалена функция `getEnvFallback()` из `model-router.ts` — больше нет хардкод fallback на moonshot/deepinfra
- `ai-sdk-stream.ts` — убран fallback на `claude-sonnet-4-5-20250929` и `gpt-4o`; теперь выбрасывает ошибку если модель не настроена в БД
- `moonshot-stream.ts` — убран fallback `MOONSHOT_URL_FALLBACK` и `DEFAULT_TEXT_MODEL`; берёт URL и modelId только из БД
- `route.ts` (chat) — `compactInBackground()` больше не использует хардкод fallback
- `fix-code/route.ts` — убран fallback на Moonshot; ошибка 503 если нет модели
- `image-generate/route.ts` — убран fallback на DeepInfra; ошибка 503 если нет модели
- `image-edit/route.ts` — убран fallback на DeepInfra/Qwen; modelId берётся из БД
- `skills/generate/route.ts` — убран fallback на Moonshot
- `agents/generate/route.ts` — убран fallback на Moonshot
- `admin/models/page.tsx` — плейсхолдер `"gpt-4o"` заменён на `"ID модели у провайдера"`
- seed.ts — оставлен как есть (начальная загрузка, ожидаемое поведение)

### Теперь все модели настраиваются через:
- `/admin/providers` — добавление AI-провайдеров (URL, API key)
- `/admin/models` — добавление моделей с привязкой к провайдерам

---

## 2. Убрать плейсхолдеры и упоминания моделей ИИ в UI
**Статус:** DONE

### Что сделано
- `MessageInput.tsx` — "Kimi K2.5 · Sanbao может ошибаться" → "Sanbao AI"
- `privacy/page.tsx` — убраны конкретные имена провайдеров "(OpenAI, Anthropic, Moonshot)"
- `constants.ts` — `APP_DESCRIPTION` обновлён на "AI-платформа для профессионалов"
- Все `console.error` с "Moonshot API error" и "DeepInfra error" переименованы в нейтральные
- Комментарий в moonshot-stream.ts переименован из "Moonshot/Kimi K2.5" в "OpenAI-compatible SSE"

---

## 3. Переработка страницы входа
**Статус:** DONE

### Что сделано
- `/login` — полностью переработана:
  - Убрана форма email/пароль
  - Оставлена только кнопка "Войти через Google"
  - Добавлены 3 иконки-фичи: Верификация фактов, SOTA точность, Нативная база знаний
  - Обновлён брендинг: "Sanbao AI — AI-платформа для профессионалов"
- `/register` — упрощена до кнопки "Зарегистрироваться через Google"
- Credentials провайдер сохранён в auth.ts (нужен для админского входа)

### WhatsApp авторизация — ОТЛОЖЕНО
- Требует WhatsApp Business API или Twilio
- Нет поля phone в модели User (нужна миграция Prisma)
- NextAuth не имеет встроенного WhatsApp провайдера
- Рекомендация: реализовать в следующем спринте

---

## 4. Python интерпретатор — серверный sandbox
**Статус:** ОТЛОЖЕНО (требует инфраструктуры)

### Текущее состояние
- Pyodide v0.27.4 (WASM в iframe) — работает в браузере
- Поддержка: numpy, pandas, matplotlib, scipy, scikit-learn, PIL, sympy
- Ограничения: нет сетевого доступа, лимит памяти, медленная загрузка пакетов

### План серверного решения (следующий спринт)
- [ ] Docker-контейнер с Python 3.12 + популярные библиотеки
- [ ] API endpoint `/api/execute-code` с timeout (30s) и лимитами
- [ ] Sandbox через Docker с ограничениями (no-network, read-only fs, memory limit 256MB)
- [ ] Интеграция с CodePreview — переключение browser/server
- [ ] Результат отображается в артефактах (stdout, images, charts)

### Библиотеки для серверного Python
numpy, pandas, matplotlib, scipy, scikit-learn, seaborn, plotly, openpyxl, requests, beautifulsoup4, sympy, pillow, statsmodels, networkx, nltk

---

## 5. Обновить системный промпт и позиционирование
**Статус:** DONE

### Что сделано
- `SYSTEM_PROMPT` в route.ts — обновлён с новым позиционированием:
  - "AI-платформа для профессионалов. Искусственный интеллект, которому можно доверять."
  - Добавлены принципы: Точность, Надёжность, Профессионализм
  - Мультимодельная архитектура с верификацией фактов, нативной базой знаний и SOTA-точностью
- `WelcomeScreen.tsx` — обновлены заголовок и описание
- `login/page.tsx` — новый брендинг с фичами

---

## Итоговый прогресс

| # | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 1 | Убрать хардкод моделей | DONE | constants.ts, model-router.ts, ai-sdk-stream.ts, moonshot-stream.ts, route.ts (chat + compact), fix-code, image-generate, image-edit, skills/generate, agents/generate, admin/models |
| 2 | Убрать плейсхолдеры моделей в UI | DONE | MessageInput.tsx, privacy/page.tsx, constants.ts |
| 3 | Переработка страницы входа | DONE | login/page.tsx, register/page.tsx |
| 4 | Python серверный sandbox | ОТЛОЖЕНО | — |
| 5 | Системный промпт и позиционирование | DONE | route.ts, WelcomeScreen.tsx, login/page.tsx |
