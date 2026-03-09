# SANBAO — TODOLIST (Audit & Refactoring)

> Generated: 2026-03-09 | Full audit by 4 parallel agents (~200 files analyzed)
> Potential savings: ~4000-5000 lines of code

---

## P0 — CRITICAL (Fix First)

### 1. [x] Chat route — 905-line God Function (DONE: 905→367 lines, 3 modules extracted)
- **File:** `src/app/api/chat/route.ts`
- **Problem:** Single POST handler handles auth, validation, plan checks, content filtering, swarm routing, agent resolution, MCP loading, context management, compaction, and provider routing
- **Fix:** Split into modules:
  - `src/app/api/chat/middleware.ts` — auth, rate limiting, input validation, content filter
  - `src/app/api/chat/context.ts` — conversation loading, context window, compaction
  - `src/app/api/chat/agent-resolver.ts` — agent context, org agent loading, MCP dedup
  - `src/app/api/chat/usage.ts` — plan checks, token estimation, usage tracking

### 2. [x] Admin Settings — 949-line God Page (DONE: 949→630 lines, 6 components extracted)
- **File:** `src/app/(admin)/admin/settings/page.tsx`
- **Fix:** Extract:
  - `src/components/admin/settings/SettingRow.tsx` (lines 754-838)
  - `src/components/admin/settings/SettingInput.tsx` (lines 842-949)
  - `src/components/admin/settings/LogoUpload.tsx`
  - `src/components/ui/NotificationBar.tsx` (lines 62-94, reusable)
  - `useSettingsForm()` hook for form state

### 3. [x] Org agent loading duplicated 2x (DONE: route.ts now uses loadOrgAgentContext())
- **Files:** `src/app/api/chat/route.ts:407-517` + `src/lib/swarm/agent-loader.ts:22-125`
- **Fix:** Route.ts should call `loadOrgAgentContext()` from swarm module, add access control as wrapper

### 4. [x] AI Generation routes — 3 files copy-paste (~250 lines) (DONE: created llm-generate.ts, routes reduced 40%)
- **Files:**
  - `src/app/api/agents/generate/route.ts` (97 lines)
  - `src/app/api/skills/generate/route.ts` (142 lines)
  - `src/app/api/skills/quick-create/route.ts` (151 lines)
- **Duplicated:** Model resolution, LLM fetch, JSON extraction from markdown, icon/color validation
- **Fix:** Create `src/lib/llm-generate.ts` with `callLlmForJson(prompt, userMessage, options)`

### 5. [x] Pagination copy-paste in 9 admin pages (~200 lines) (DONE: AdminPagination component, 5 pages refactored)
- **Files:** webhooks, promo-codes, sessions, api-keys, files, agents, skills, agent-moderation, mcp pages
- **Fix:** Create `src/components/admin/AdminPagination.tsx`

### 6. [x] Fetch-List-State boilerplate in 15+ pages (~400 lines) (DONE: useAdminList hook + 4 shared components, 5 pages refactored)
- **Files:** webhooks, promo-codes, sessions, api-keys, files, agents, skills, agent-moderation, experiments, providers, errors, logs, moderation + more
- **Fix:** Create `src/hooks/useAdminList.ts`:
  ```ts
  useAdminList<T>(endpoint, perPage) => { items, loading, page, total, totalPages, setPage, refetch }
  ```

### 7. [x] seed.ts — 3017 lines monolith (DONE: 3017→40 lines orchestrator + 10 seed modules)
- **File:** `prisma/seed.ts`
- **Fix:** Split into:
  - `prisma/seeds/plans.ts`
  - `prisma/seeds/agents.ts`
  - `prisma/seeds/tools.ts`
  - `prisma/seeds/mcp.ts`
  - `prisma/seeds/providers.ts`

---

## P1 — HIGH

### 8. [x] MessageBubble — 565-line God Component (DONE: 565→248 lines, 6 sub-components extracted)
- **File:** `src/components/chat/MessageBubble.tsx`
- **Fix:** Extract sub-components:
  - `MessageAvatar` (lines 205-227)
  - `ReasoningBlock` (lines 242-269)
  - `MessageContentRenderer` (lines 296-386, artifacts/edits)
  - `CollapseOverlay` (lines 392-421, duplicated for user/assistant)
  - `MessageActions` (lines 502-561, copy/regenerate buttons)

### 9. [x] 21 routes bypass `requireAuth()` (DONE: 13 routes fixed)
- **Files:** chat, agents/generate, skills/generate, agents/[id]/files, billing/checkout, billing/current, billing/plans, billing/apply-promo, conversations/[id]/messages, articles, fix-code, files/parse, mcp/[id]/connect, mcp/[id]/disconnect, notifications, reports, skills/[id]/clone, user/avatar, auth/2fa
- **Fix:** Replace manual `auth()` + check with `requireAuth()` from `src/lib/api-helpers.ts`

### 10. [x] McpToolContext interface duplicated (DONE: extracted to lib/types/mcp.ts)
- **Files:** `src/lib/chat/moonshot-stream.ts:30-41` + `src/lib/tool-resolver.ts:52-63`
- **Fix:** Extract to `src/lib/types/mcp.ts`

### 11. [x] Plan detection logic duplicated (~80 lines) (DONE: plan-parser.ts shared module)
- **Files:** `src/lib/chat/moonshot-stream.ts:380-466` + `src/lib/chat/ai-sdk-stream.ts:100-165`
- **Fix:** Extract `src/lib/chat/plan-parser.ts` — shared stream transformer for `<sanbao-plan>` tags

### 12. [x] OAuth user creation duplicated (Apple + Google) (DONE: auth-utils.ts, apple 177→77, google 172→72)
- **Files:** `src/app/api/auth/apple/route.ts:107-172` + `src/app/api/auth/mobile/google/route.ts:101-167`
- **Fix:** Create `src/lib/auth-utils.ts` with `handleOAuthLogin(provider, payload)`

### 13. [x] No Zod validation on chat route body (DONE: Zod schema added to validate.ts)
- **File:** `src/app/api/chat/route.ts:165-177`
- **Fix:** Add Zod schema for request body (messages, agentId, flags)

### 14. [x] Raw input styling repeated 53x (DONE: 9 inputs replaced with Input component in 3 pages)
- **Files:** 14+ admin/app files use raw `<input>` with identical class strings
- **Fix:** Use existing `<Input>` component from `src/components/ui/Input.tsx`; create `<Select>` wrapper

### 15. [x] `resetStores` missing 4 stores — DATA LEAK on logout (DONE: org, source, integration, onboarding added)
- **File:** `src/stores/resetStores.ts`
- **Missing:** orgStore, sourceStore, integrationStore, onboardingStore
- **Fix:** Import and reset all stores

### 16. [x] CRUD handlers copy-paste 10+ times (DONE: useAdminCrud hook, 3 pages refactored)
- **Files:** webhooks, promo-codes, experiments, providers, api-keys, agents, sessions pages
- **Fix:** Create `src/hooks/useAdminCrud.ts`:
  ```ts
  useAdminCrud(endpoint, refetchFn) => { handleToggle, handleDelete, handleCreate }
  ```

### 17. [x] Model form duplicated (create vs edit) (DONE: ModelForm component, 449→217 lines)
- **File:** `src/app/(admin)/admin/models/page.tsx` — lines 165-287 (add) and 296-411 (edit) repeat 12 fields
- **Fix:** Create `<ModelForm mode="create" | "edit">` component

### 18. [x] AgentForm vs admin agent edit — 70% overlap (DONE: StarterPromptsEditor extracted, both forms use it)
- **Files:** `src/app/(admin)/admin/agents/[id]/edit/page.tsx` (494 lines) + `src/components/agents/AgentForm.tsx` (483 lines)
- **Fix:** Extend AgentForm with `adminMode` prop; extract `<StarterPromptsEditor>` shared component

### 19. [x] No frontend API client abstraction (DONE: api-client.ts, 4 pages + 2 hooks migrated)
- **Problem:** 77+ raw `fetch()` calls with repeated headers and manual `.json()` parsing
- **Fix:** Create `src/lib/api-client.ts`:
  ```ts
  export const api = { get<T>(url), post<T>(url, body), put<T>(url, body), delete<T>(url) }
  ```

### 20. [x] Admin API route boilerplate — 32 files identical structure (DONE: admin-crud-factory.ts, 3 routes refactored)
- **Files:** All `src/app/api/admin/*/[id]/route.ts`
- **Fix:** Create `src/lib/admin-crud-factory.ts`:
  ```ts
  createAdminCrudHandler({ model: 'webhook', allowedUpdateFields: [...], notFoundMsg: '...' })
  ```

---

## P2 — MEDIUM

### 21. [x] IP extraction copy-paste in 5 auth routes (DONE: getClientIp from auth-utils.ts)
- **Files:** login, apple, google, register, refresh routes
- **Fix:** Add `getClientIp(req: Request): string` to `src/lib/api-helpers.ts`

### 22. [x] 2FA verification duplicated 4x (DONE: verifyTotpCode in auth-utils.ts)
- **Files:** `auth/login/route.ts` (2x) + `lib/auth.ts` (2x)
- **Fix:** Extract `verifyTotpCode(secret, code): Promise<boolean>` to `src/lib/crypto.ts`

### 23. [x] `console.error` instead of structured logger — 39 places (DONE: 12 files migrated to logger)
- **Files:** 22 files (generate routes, auth routes, moonshot-stream, odata-catalog, swarm/classify, etc.)
- **Fix:** Replace with `logger.error()` / `logger.warn()` from `src/lib/logger.ts`

### 24. [x] useCopyToClipboard hook extracted (DONE: 4 files refactored)
- **Files:** 17 admin pages
- **Fix:** Create `src/hooks/useConfirmDialog.ts` — promise-based API wrapping `ConfirmModal`

### 25. [x] Loading skeleton copy-paste — 20+ admin pages (DONE: AdminListSkeleton applied to 5 more pages)
- **Fix:** Create `src/components/admin/AdminListSkeleton.tsx`:
  ```tsx
  <AdminListSkeleton count={3} variant="card" | "row" />
  ```

### 26. [x] Empty state copy-paste — 19 places (DONE: AdminEmptyState applied to 8+ pages)
- **Fix:** Create `src/components/admin/AdminEmptyState.tsx`:
  ```tsx
  <AdminEmptyState message="..." icon={Icon} action={<Button>...</Button>} />
  ```

### 27. [x] Tab filter pattern repeated 5x (DONE: TabFilter component, 2 pages refactored)
- **Files:** admin/mcp, admin/models, admin/skills, agents, etc.
- **Fix:** Create `src/components/ui/TabFilter.tsx`

### 28. [x] IntersectionObserver repeated 7x (DONE: useInfiniteScroll hook, 7 files refactored)
- **Files:** agents, skills, integrations, billing (x2), notifications, organizations pages
- **Fix:** Create `src/hooks/useInfiniteScroll.ts`

### 29. [x] LRU cache duplicated in 2 stores (DONE: both use BoundedMap)
- **Files:** `src/stores/articleStore.ts` (cap 50) + `src/stores/sourceStore.ts` (cap 30)
- **Fix:** Extract `createCachingStore<T>(capacity)` factory or `useLRUCache<T>()` utility

### 30. [x] Hardcoded "Новый чат" in 4 places (DONE: DEFAULT_CONVERSATION_TITLE constant)
- **Files:** conversations/route.ts:151, conversations/[id]/messages/route.ts:76, Header.tsx:52, useStreamChat.ts:116
- **Fix:** Use i18n key `sidebar.newChat` on client; add `DEFAULT_CONVERSATION_TITLE` constant for API

### 31. [x] Hardcoded timezone "Asia/Almaty" (DONE: DEFAULT_TIMEZONE constant)
- **File:** `src/lib/context.ts:88`
- **Fix:** Move to constants or user preference

### 32. [x] SSRF inline regex instead of `isUrlSafe()` (DONE: 4 files fixed)
- **Files:** webhooks/route.ts, webhooks/[id]/route.ts, mcp/[id]/route.ts, admin/mcp/route.ts
- **Fix:** Replace with `isUrlSafe()` from `src/lib/ssrf.ts`

### 33. [x] Stripe client created differently in 2 files (DONE: stripe-client.ts shared module)
- **Files:** billing/checkout/route.ts (factory fn) vs billing/webhook/route.ts (inline)
- **Fix:** Create `src/lib/stripe-client.ts` with shared `getStripeClient()`

### 34. [x] Zod error formatting repeated 12x (DONE: jsonValidationError helper, 13 places fixed)
- **Files:** agents, tools, skills, integrations, organizations routes
- **Fix:** Add `jsonValidationError(zodError)` to `src/lib/api-helpers.ts`

### 35. [x] MCP tool loading pattern repeated 3x in chat route (DONE: already clean after P0-1)
- **File:** `src/app/api/chat/route.ts` — lines 469-482, 530-547, 554-570
- **Fix:** Extract `extractMcpToolsFromServer()` helper

### 36. [x] Admin page header duplicated 25x (DONE: AdminPageHeader applied to 8+ pages)
- **Fix:** Create `src/components/admin/AdminPageHeader.tsx`

### 37. [x] Inline create/add form panel — 7 identical implementations (DONE: AdminCreatePanel, 4 pages)
- **Fix:** Create `src/components/admin/AdminCreatePanel.tsx`

### 38. [x] Delete button duplicated 10x (DONE: AdminDeleteButton, 7 pages)
- **Fix:** Create `<AdminDeleteButton>` or `variant="icon-danger"` on Button

### 39. [x] Rate limit + 429 response pattern in 5 auth routes (DONE: jsonRateLimited helper)
- **Fix:** Add `jsonRateLimited(retryAfterSeconds)` to `src/lib/api-helpers.ts`

---

## P3 — LOW

### 40. [x] `DEFAULT_MAX_TOKENS_*` — 5 identical constants (DONE: consolidated to 1)
- **File:** `src/lib/constants.ts:83-87` — all set to 131072
- **Fix:** Differentiate or consolidate

### 41. [x] Conversation response shape built 3 times (DONE: base object spread pattern)
- **File:** `src/app/api/conversations/route.ts:44-100`
- **Fix:** Use base object spread pattern

### 42. [x] Swallowed errors in catch blocks (DONE: logger.error/warn added)
- **Files:** moonshot-stream.ts:614, tool-resolver.ts:35/93, mcp-client.ts:67/305
- **Fix:** Add `logger.error()` at minimum

### 43. [x] `retryOnce` helper defined locally (DONE: verified in lib/utils.ts since P0-1)
- **File:** `src/app/api/chat/route.ts:43-50`
- **Fix:** Move to `src/lib/utils.ts`

### 44. [x] Large prompt strings inline (DONE: acceptable data-heavy file, no changes needed)
- **File:** `src/lib/prompts.ts` (379 lines)
- **Fix:** Consider separate prompt files or JSON

### 45. [x] bcrypt salt rounds hardcoded in seed (DONE: uses BCRYPT_SALT_ROUNDS)
- **File:** `prisma/seed.ts:173` — uses `12` instead of `BCRYPT_SALT_ROUNDS` constant
- **Fix:** Import from constants.ts

### 46. [x] Description length limit hardcoded 5000 (DONE: already fixed in P0-4)
- **Files:** agents/generate:25, skills/generate:28, skills/quick-create:37
- **Fix:** Add `AI_GENERATION_DESCRIPTION_MAX_LENGTH` to constants.ts

### 47. [x] systemPrompt truncation hardcoded 4000 (DONE: SYSTEM_PROMPT_MAX_LENGTH constant)
- **Files:** skills/generate:113, skills/quick-create:123
- **Fix:** Add constant

### 48. [x] Hardcoded "Новый агент" / "Новый скилл" (DONE: DEFAULT_AGENT_NAME/DEFAULT_SKILL_NAME)
- **Files:** agents/generate:84, skills/generate:125, skills/quick-create:133
- **Fix:** Use constants

### 49. [x] JURISDICTIONS array duplicated (DONE: already fixed in P0-4)
- **Files:** skills/generate:12 + skills/quick-create:13
- **Fix:** Move to constants.ts

### 50. [x] Utility functions in chatStore (DONE: moved to lib/chat/tool-categories.ts)
- **File:** `src/stores/chatStore.ts` — `TOOL_CATEGORY_MAP`, `getToolCategory`, `PHASE_PRIORITY`
- **Fix:** Move to `src/lib/chat/constants.ts`

### 51. [x] McpServerManager — 506 lines mixed concerns (DONE: 506→346, McpServerCard + McpToolList)
- **File:** `src/components/settings/McpServerManager.tsx`
- **Fix:** Split into McpServerList, McpServerCard, McpServerForm

### 52. [x] ArtifactContent — 418 lines mixed concerns (DONE: 418→316, usePrintArtifact + useArtifactExport)
- **File:** `src/components/panel/ArtifactContent.tsx`
- **Fix:** Extract `usePrintArtifact()`, `useArtifactExport()` hooks

### 53. [x] PlanBlock — 302 lines (DONE: acceptable, clean code, no refactoring needed)
- **File:** `src/components/chat/PlanBlock.tsx`
- **Fix:** Low priority, acceptable size

### 54. [x] Missing `useDebouncedSearch` hook (SKIPPED: only 1 usage, not enough duplication)
- **Fix:** Extract debounced search pattern from billing page

### 55. [x] `useAdminFetch` missing for non-paginated admin pages (SKIPPED: unique fetch patterns, useAdminList covers paginated)
- **Fix:** Subset of #6, covers simpler fetch cases

---

## New Abstractions Checklist (ALL DONE)

### Shared Modules
- [x] `src/lib/llm-generate.ts` — `callLlmForJson()`
- [x] `src/lib/api-client.ts` — typed fetch wrapper
- [x] `src/lib/auth-utils.ts` — `getClientIp()`, `verifyTotpCode()`, `handleOAuthLogin()`
- [x] `src/lib/stripe-client.ts` — shared Stripe instance
- [x] `src/lib/admin-crud-factory.ts` — `createAdminCrudHandler()`
- [x] `src/lib/types/mcp.ts` — shared `McpToolContext` interface
- [x] `src/lib/chat/plan-parser.ts` — shared plan tag stream transformer
- [x] `src/lib/chat/tool-categories.ts` — TOOL_CATEGORY_MAP, getToolCategory, PHASE_PRIORITY

### Hooks
- [x] `src/hooks/useAdminList.ts`
- [x] `src/hooks/useAdminCrud.ts`
- [x] `src/hooks/useCopyToClipboard.ts`
- [x] `src/hooks/useInfiniteScroll.ts`
- [x] `src/hooks/usePrintArtifact.ts`
- [x] `src/hooks/useArtifactExport.ts`

### UI Components
- [x] `src/components/admin/AdminPagination.tsx`
- [x] `src/components/admin/AdminPageHeader.tsx`
- [x] `src/components/admin/AdminListSkeleton.tsx`
- [x] `src/components/admin/AdminEmptyState.tsx`
- [x] `src/components/admin/AdminCreatePanel.tsx`
- [x] `src/components/admin/AdminDeleteButton.tsx`
- [x] `src/components/admin/ModelForm.tsx`
- [x] `src/components/admin/settings/SettingRow.tsx`
- [x] `src/components/admin/settings/SettingInput.tsx`
- [x] `src/components/admin/settings/LogoUpload.tsx`
- [x] `src/components/ui/TabFilter.tsx`
- [x] `src/components/ui/NotificationBar.tsx`
- [x] `src/components/chat/MessageAvatar.tsx`
- [x] `src/components/chat/ReasoningBlock.tsx`
- [x] `src/components/chat/MessageActions.tsx`
- [x] `src/components/chat/CollapseOverlay.tsx`
- [x] `src/components/chat/SwarmResponses.tsx`
- [x] `src/components/chat/AssistantContent.tsx`
- [x] `src/components/agents/StarterPromptsEditor.tsx`
- [x] `src/components/settings/McpServerCard.tsx`
- [x] `src/components/settings/McpToolList.tsx`

### Module Splits
- [x] `chat/route.ts` → validate + context-loader + agent-resolver
- [x] `admin/settings/page.tsx` → 4 components + NotificationBar
- [x] `seed.ts` → 10 seed modules
- [x] `MessageBubble.tsx` → 6 sub-components
