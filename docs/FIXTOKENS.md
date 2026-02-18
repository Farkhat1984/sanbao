# Token / Billing / Usage Audit — Tracker

> Created: 2026-02-18
> Status: In Progress

## Critical Bugs

| # | Bug | File | Fix | Status |
|---|-----|------|-----|--------|
| B1 | `maxStorageMb` не сохраняется — нет в `allowedFields` | `api/admin/plans/[id]/route.ts` | Добавлено в allowedFields | ✅ Done |
| B2 | `logTokenUsage()` нигде не вызывается → TokenLog пуст | `src/lib/audit.ts` | Подключен onUsage callback в route.ts | ✅ Done |
| B3 | Токены считаются грубо (chars/3) только на INPUT | `route.ts:716-720` | onUsage корректирует после стрима (delta = real - estimated) | ✅ Done |
| B4 | `Model.maxTokens` хранится но ИГНОРИРУЕТСЯ — всегда `plan.tokensPerMessage` | `route.ts:747,779` | `min(plan.tokensPerMessage, textModel.maxTokens)` | ✅ Done |
| B5 | `Model.contextWindow` хранится но ИГНОРИРУЕТСЯ — всегда `plan.contextWindowSize` | `route.ts:680` | `min(plan.contextWindowSize, textModel.contextWindow)` | ✅ Done |

## Logical Conflicts

| # | Conflict | Resolution | Status |
|---|----------|-----------|--------|
| L1 | Plan.tokensPerMessage vs Model.maxTokens — План всегда побеждает | `min(plan, model)` — побеждает меньшее значение | ✅ Fixed |
| L2 | Plan.contextWindowSize vs Model.contextWindow — План всегда побеждает | `min(plan, model)` — побеждает меньшее значение | ✅ Fixed |
| L3 | `documentsPerMonth` — хранится, показывается, не enforce-ится | Документировано. Enforce потребует подсчёта артефактов. Приоритет: low | 📋 Documented |
| L4 | `canUseRag`, `canUseGraph` — хранится, показывается, не enforce-ится | Документировано. Нет RAG/Graph функционала пока. | 📋 Documented |
| L5 | `canChooseProvider` — хранится, показывается, нет UI для выбора | Документировано. UI для выбора провайдера — отдельная задача. | 📋 Documented |

## Analytics Pages

| Page | Status | Data Source | Fix |
|------|--------|-------------|-----|
| /admin/analytics | Код ОК, секции cost/provider пусты | DailyUsage (ОК) + TokenLog (пуст) | TokenLog теперь заполняется через onUsage | ✅ |
| /admin/usage | Код ОК, таблица пуста | TokenLog (пуст) | TokenLog теперь заполняется через onUsage | ✅ |

## Changes Made

### Phase 1: Quick Fixes

1. **`src/app/api/admin/plans/[id]/route.ts`** — добавлен `"maxStorageMb"` в allowedFields
2. **`src/app/api/chat/route.ts`** — resolveModel перенесён до context check; `min(plan, model)` для contextWindow и maxTokens в обоих stream-путях

### Phase 2: Token Logging

3. **`src/lib/model-router.ts`** — добавлены `costPer1kInput`, `costPer1kOutput` в ResolvedModel, ModelWithProvider, toResolvedModel
4. **`src/lib/chat/moonshot-stream.ts`** — `onUsage` callback; аккумуляция usage из SSE chunks
5. **`src/lib/chat/ai-sdk-stream.ts`** — `onUsage` callback; async usage reporting через `result.usage`
6. **`src/app/api/chat/route.ts`** — `onUsage` callback с fire-and-forget: коррекция DailyUsage + запись в TokenLog

### Phase 3: Tests

7. **`src/__tests__/lib/token-hierarchy.test.ts`** — тесты min(plan, model) иерархии
8. **`src/__tests__/lib/token-logging.test.ts`** — тесты logTokenUsage() с мокнутым Prisma
9. **`src/__tests__/lib/stream-usage-callback.test.ts`** — тесты логики коррекции токенов

## Unenforced Plan Fields (for future work)

These fields are stored in the Plan model and displayed in admin UI, but not enforced at runtime:

| Field | Purpose | Enforcement Needed |
|-------|---------|-------------------|
| `documentsPerMonth` | Monthly document creation limit | Count artifacts per user per month, check before creating |
| `canUseRag` | RAG access flag | Block RAG-related tool calls when false |
| `canUseGraph` | Graph DB access flag | Block graph-related tool calls when false |
| `canChooseProvider` | Provider selection flag | Add UI for model/provider selection, gate by this flag |

## Verification Checklist

- [ ] `npm run build` — no TypeScript errors
- [ ] `npm run test` — all tests pass (including new ones)
- [ ] Send a chat message → check TokenLog is populated (via prisma studio or /admin/usage)
- [ ] /admin/analytics — "Распределение по провайдерам" section shows data
- [ ] /admin/usage — table shows records with input/output/cost
- [ ] /admin/plans → edit maxStorageMb → value persists
- [ ] Hierarchy: if Model.maxTokens=4096 and Plan.tokensPerMessage=16000, then effective max_tokens=4096
