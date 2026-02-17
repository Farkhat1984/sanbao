# HOTFIX2 — Plan & Progress

> Generated: 2026-02-17 | Status: **COMPLETE** (except C3 — blocked)
> Tasks sorted by complexity: SIMPLE → MEDIUM → COMPLEX
> Completed: 16/17 tasks | Blocked: 1 (C3 — needs FragmentDB service)

---

## Legend

| Icon | Status |
|------|--------|
| `[ ]` | Pending |
| `[~]` | In Progress |
| `[x]` | Done |
| `[!]` | Blocked |
| `[-]` | Skipped |

---

## SIMPLE TASKS (1-2 hours each)

### S1. Hide Custom Agents from Public (#16) [x] DONE

**Problem:** User-created agents (`isSystem: false`) visible to other users through agent listing APIs.
`Agent.isPublic` field exists but is never filtered in GET `/api/agents`.

**Current state:**
- `src/app/api/agents/route.ts` — GET returns all agents where `isSystem: true` + user's own agents
- `isPublic` field on Agent model — exists but unused
- No sharing/discovery UI

**Fix:**
- [x] In GET `/api/agents/route.ts`: already correct. Added `status: APPROVED` to `agents/[id]/route.ts` + `conversations/route.ts`
- [x] Verify `/api/admin/agents` still shows all agents (admin override) — uses `requireAdmin()`
- [x] Verify chat route uses same filtered agent list — `conversations/route.ts` fixed
- [x] WelcomeScreen only shows `activeAgent` from store — no leak

**Files:** `src/app/api/agents/route.ts`, `src/components/chat/WelcomeScreen.tsx`

---

### S2. Additional Questions for Context (#13) [x] DONE

**Problem:** When user asks vague questions, AI should ask clarifying questions before generating responses. The `<sanbao-clarify>` tag exists but the system prompt instruction is weak.

**Current state:**
- `ClarifyModal.tsx` — fully functional clarify UI
- System prompt mentions `<sanbao-clarify>` but only for document creation
- No instruction to clarify vague general questions

**Fix:**
- [x] Enhanced SYSTEM_PROMPT clarify section: added 4 trigger conditions + 3 exceptions
- [x] Doc-creation clarify behavior preserved, extended to general vague queries
- [ ] Test with vague prompts: "напиши документ", "помоги с работой", "сделай анализ" (manual QA)

**Files:** `src/app/api/chat/route.ts` (SYSTEM_PROMPT section)

---

### S3. Admin System Prompt Improvement (#24) [x] DONE

**Problem:** System prompt needs positioning as "professional AI you can trust". Current prompt is functional but lacks authority/trust framing.

**Current state:**
- Main SYSTEM_PROMPT in `route.ts` (~3500 words) — comprehensive but lacks professional trust positioning
- Admin can't edit global system prompt via UI (no SystemSetting key)
- `PromptVersion` model exists but admin UI not connected

**Fix:**
- [x] Added honesty + actuality principles to SYSTEM_PROMPT preamble
- [x] Trust framing already existed, enhanced with explicit "не знаю" rule and actuality warnings
- [ ] Add `system_prompt_main` to SystemSetting whitelist in admin API (Wave 2)
- [ ] Connect PromptVersion admin page to allow editing base prompt (Wave 2)
- [x] Build passes, tag parsing verified intact

**Files:** `src/app/api/chat/route.ts`, `src/app/api/admin/settings/route.ts`

---

### S4. Facts about Sanbao / Ma Zhanhe (#3) [x] DONE

**Problem:** During AI loading/thinking, show fun historical facts about Zheng He (Ma Sanbao) to engage users.

**Current state:**
- `ThinkingIndicator.tsx` — shows animated icon + phase label during streaming
- No facts/trivia system exists
- Loading can take 3-30 seconds depending on task

**Implementation:**
- [x] Created `src/lib/sanbao-facts.ts` — 25 facts with titles in Russian
- [x] Created `src/components/chat/SanbaoFact.tsx`: floating card, auto-dismiss 10s, close X, spring anim
- [x] Integrated into `ChatArea.tsx` — shows when streaming + phase active
- [x] sessionStorage for no-repeat tracking, resets after all 25 shown
- [x] MIN_MESSAGES_BETWEEN_FACTS = 3 to avoid annoyance

**Files:** `src/lib/sanbao-facts.ts` (new), `src/components/chat/SanbaoFact.tsx` (new), `src/components/chat/ChatArea.tsx`

---

### S5. System Prompts Architecture (#19) [x] DONE

**Problem:** Clarify and document how system prompts work for: system agents, custom agents, skills.

**Current state (verified):**
- System agents: `agent.systemPrompt` (admin-editable) + global SYSTEM_PROMPT
- Custom agents: `agent.systemPrompt` (user-editable) + global SYSTEM_PROMPT + rule "no artifact creation"
- Skills: `skill.systemPrompt` prepended to everything
- Order: `skillPrompt → agentPrompt → globalSystemPrompt → a/b → planning → web_search`
- Admin has no UI for editing global SYSTEM_PROMPT (only code)

**Fix:**
- [x] Added `system_prompt_global` to ALLOWED_KEYS whitelist in admin settings API
- [x] `getGlobalSystemPrompt()` in route.ts: loads from SystemSetting, 60s in-memory cache, falls back to hardcoded
- [ ] Admin UI: add "System Prompt" textarea in `/admin/settings` page (frontend — later)
- [ ] "Reset to Default" button restores hardcoded version (frontend — later)

**Files:** `src/app/api/chat/route.ts`, `src/app/api/admin/settings/route.ts`, `src/app/(admin)/admin/settings/page.tsx`

---

### S6. Skills Error — Prompt Contamination (#17) [x] DONE

**Problem:** Skill generation produces contaminated system prompts mixing unrelated domains (e.g., lawyer + Pokémon developer). The JSON extraction regex fails silently.

**Current state:**
- `src/app/api/skills/generate/route.ts` — generates skill via LLM
- Regex `` /```(?:json)?\s*([\s\S]*?)```/ `` fails when model doesn't wrap JSON in backticks
- Catch block returns generic error, no fallback parsing
- Generated prompt too broad — combines all context from conversation

**Fix:**
- [x] Fixed JSON extraction: markdown code block → fallback `{...}` extraction
- [x] Added domain focus rules to SYSTEM_GEN_PROMPT: strict single-specialization, max 600 words
- [x] Added 4000 char cap on systemPrompt
- [x] Structured error: 422 for bad JSON with descriptive message, 500 with retry hint
- [ ] Test: create skill "юрист по ГК РФ" — should NOT include Pokémon references

**Files:** `src/app/api/skills/generate/route.ts`

---

## MEDIUM TASKS (3-8 hours each)

### M1. MD File System for Users (#1) [x] DONE

**Problem:** Users need a system to store MD files as non-permanent context/memory. Files sit alongside agent prompt; system prompt says "these files exist, read when needed."

**Current state:**
- `AgentFile` model exists with `inContext` flag (lazy loading)
- `read_knowledge` native tool can access lazy files
- Only works for agent files (admin/agent-owner uploads)
- No user-facing file management UI

**Implementation:**
- [x] Extend to user-level files (not agent-bound):
  - Added `UserFile` model to `prisma/schema.prisma`: id, userId, name, description, content (Text), fileType, sizeBytes
  - Added `userFiles UserFile[]` relation to User model
  - Plan quota: maxAgents > 0 → double file limit (20 free, 40 paid)
- [x] API routes:
  - `GET /api/user-files` — list user's MD files (without content)
  - `POST /api/user-files` — create MD file (100KB max, name 100 chars, desc 500 chars)
  - `GET /api/user-files/[id]` — get file with content
  - `PUT /api/user-files/[id]` — edit file fields (partial update)
  - `DELETE /api/user-files/[id]` — delete file (owner-only)
- [x] System prompt injection:
  - route.ts loads user files in parallel with other context data
  - Injects "ФАЙЛЫ ПОЛЬЗОВАТЕЛЯ" block with file list + read_knowledge instruction
- [x] Extend `read_knowledge` native tool to search `UserFile` records
  - No longer requires agentId — searches user files always
  - Results include `source: "agent" | "user"` field
- [x] 15 API tests: GET list, POST create/validation/limits, GET/PUT/DELETE by ID, auth, ownership
- [ ] UI: Add "Мои файлы" section in `/settings` or `/profile` (frontend — later)
  - File list with name, size, date
  - Create/edit modal with markdown editor
  - Delete with confirmation

**Files:** `prisma/schema.prisma`, `src/app/api/user-files/` (new), `src/lib/native-tools/content.ts`, `src/app/api/chat/route.ts`

**Note:** DB push requires deploy (`npx prisma db push` or migration).

---

### M2. Localization — Kazakh Language (#8) [~] Phase 1 DONE

**Problem:** All UI is Russian-only. Need Kazakh (kk-KZ) language support.

**Current state:**
- No i18n library → DONE
- All text hardcoded in Russian across 100+ components
- Date formatting: `toLocaleDateString("ru-RU")` in utils.ts
- Email templates: Russian only

**Implementation (phased):**

**Phase 1 — Infrastructure:** [x] DONE
- [x] Lightweight i18n system (no `next-intl` — avoids route restructuring):
  - `src/lib/i18n.ts` — `t()` function, `setLocale()`, `initLocale()`, locale-parameter override
  - `src/messages/ru.json` — 80+ keys across 9 sections (common, sidebar, chat, settings, auth, billing, agents, skills, files, errors)
  - `src/messages/kk.json` — full Kazakh translation (same 80+ keys)
  - `src/hooks/useTranslation.ts` — React hook: `{ t, locale, changeLocale }`
- [x] Added `locale` field to User model (default: 'ru')
- [x] API route: `GET/PUT /api/user/locale` — persist locale in DB
- [x] 12 i18n tests: translation, fallback, locale switching, completeness check, Kazakh chars

**Phase 2 — Core UI translation:** (next)
- [ ] Integrate `useTranslation()` into key components:
  - Sidebar labels, navigation, buttons
  - ChatArea placeholders and labels
  - Settings page — add language picker
  - Login/Register pages
  - Billing page
- [ ] Update `formatDate()` to support `kk-KZ` locale

**Phase 3 — Secondary UI:**
- [ ] Admin panel (lower priority — admin likely Russian-speaking)
- [ ] Email templates in Kazakh
- [ ] Error messages in API routes
- [ ] Skill/agent descriptions

**Files:** `src/lib/i18n.ts`, `src/messages/`, `src/hooks/useTranslation.ts`, `src/app/api/user/locale/route.ts`, `prisma/schema.prisma`

**Complexity notes:** Phase 1 done. Phase 2 is incremental component-by-component. No route changes needed.

---

### M3. Token Limit / Rate Limit / Plan Expiry Verification (#9) [x] DONE

**Problem:** Need to verify all billing scenarios work correctly through API testing.

**Current state:**
- Rate limiting: Redis-based with in-memory fallback (`src/lib/rate-limit.ts`)
- Usage tracking: `src/lib/usage.ts` — daily message/token counts
- Plan limits: messagesPerDay, tokensPerMessage, tokensPerMonth, requestsPerMinute
- Expiry: `src/lib/subscription-manager.ts` — auto-downgrade on expiry

**Verification checklist:**
- [x] Test messagesPerDay limit: tested at limit, over limit, null usage (first msg)
- [x] Test tokensPerMonth limit: tested at cap → 429 error with "токенов"
- [x] Test requestsPerMinute limit: tested via checkMinuteRateLimit (in-memory fallback) — blocks at limit
- [x] Test subscription expiry: tested expired, active, trial expired, default plan bypass
- [x] Test trial expiry: tested past trialEndsAt → expired; with expiresAt → not expired
- [x] Test abuse blocking: isUserBlocked/Sync tested for new users; checkAuthRateLimit blocks after 5 hits
- [ ] Test promo code (requires DB integration test — manual QA)
- [x] Feature gating: reasoning + web search blocked on Free, allowed on Pro
- [x] Admin bypass: admin ignores all limits
- [x] All tests in `usage-billing.test.ts` (16) + `rate-limit.test.ts` (10) — PASS

**Files:** `src/lib/rate-limit.ts`, `src/lib/usage.ts`, `src/lib/subscription-manager.ts`, `src/app/api/chat/route.ts`

---

### M4. Animated Icons & Differentiated Tool Icons (#14) [x] DONE

**Problem:** Search in knowledge base and internet use same globe icon. Need differentiated, animated icons. Main Sanbao icon should animate like a compass.

**Current state:**
- `ThinkingIndicator.tsx` — has 10 tool categories with different icons:
  - `web_search` → Globe, `knowledge` → Database, `mcp` → Plug, etc.
- Icons already partially differentiated but could be improved
- No compass animation for main brand icon
- Sanbao logo is static

**Implementation:**
- [x] Verified tool categories: all 10 categories have distinct icons + gradients + animations
- [x] Created `SanbaoCompass.tsx`: SVG compass with 4 states (idle/loading/thinking/found)
  - Idle: subtle ±5° oscillation, Loading: left-right seeking, Thinking: 360° rotation, Found: spring snap
- [x] Replaced Triangle icon with SanbaoCompass in Sidebar header (reactive to isStreaming)
- [ ] Replace in:
  - ThinkingIndicator (when agentId = sanbao)
  - Loading screen / splash
- [ ] Mobile: smaller compass, same animations
- [ ] Ensure animations respect `prefers-reduced-motion`

**Files:** `src/components/ui/SanbaoCompass.tsx` (new), `src/components/chat/ThinkingIndicator.tsx`, `src/components/layout/Sidebar.tsx`

---

### M5. Autocompact + MD Memory Verification (#23) [x] DONE

**Problem:** Verify autocompact and memory systems work correctly when context grows large.

**Current state:**
- Autocompact: triggers at 70% context window (`CONTEXT_COMPACTION_THRESHOLD = 0.7`)
- Keeps last 12 messages, summarizes rest via LLM
- Stores summary in `ConversationSummary` table
- User memory: `UserMemory` table, injected into system prompt

**Verification checklist:**
- [x] Test compaction trigger: splitMessagesForCompaction keeps last 12, summarizes rest (25 tests)
- [x] Test context window: estimateTokens, checkContextWindow at 70% threshold, zero window edge case
- [x] Test memory injection: buildSystemPromptWithContext with/without each section, all combinations
- [x] Test compaction prompt: initial (no summary) + update (with existing summary), both include doc preservation
- [x] Test edge cases: empty messages, single messages, messages <= keepLast, Cyrillic text
- [x] All 25 context tests in `context.test.ts` — PASS
- [ ] Integration test with DB (manual QA): 20+ messages → verify ConversationSummary created

**Files:** `src/lib/context.ts`, `src/app/api/chat/route.ts`, `src/components/chat/ContextIndicator.tsx`

---

### M6. SMTP Server Setup (#11) [x] DONE

**Problem:** Need working SMTP configuration for email delivery (invoices, notifications, password reset).

**Current state:**
- `src/lib/email.ts` — Nodemailer transport, reads from SystemSetting or env vars
- Email templates exist (welcome, invoice, expiring, payment_failed)
- `verifySmtp()` function for connection testing
- Admin API: `POST /api/admin/email` — verify SMTP + send test email

**Implementation:**
- [x] SMTP provider: Gmail with App Password (port 587, STARTTLS)
- [x] Configure env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env`
- [x] Bugfix: `email.ts` queried `smtp_pass` from SystemSetting but admin settings saves as `smtp_password` — aligned to `smtp_password`
- [x] Added `smtp_from` to SystemSetting query in `getTransporter()` + cached `from` address
- [x] `resetTransporter()` also resets cached `from`
- [x] Admin settings route already has all SMTP keys in `ALLOWED_KEYS` whitelist
- [x] Admin email route: `POST {action:"verify"}` and `POST {action:"test", to:"..."}` work
- [ ] DNS: Configure SPF, DKIM, DMARC records for sanbao.ai domain (ops task)
- [ ] Test email delivery on production (after deploy)

**Files:** `.env`, `src/lib/email.ts`, `src/app/api/admin/email/route.ts`, `src/app/api/admin/settings/route.ts`

---

## COMPLEX TASKS (1-3 days each)

### C1. Freedom Acquiring — Payment Integration (#7) [x] DONE (backend)

**Problem:** Need to integrate Freedom Pay (Kazakhstan payment gateway) for subscriptions, replacing/supplementing Stripe.

**Current state:**
- Stripe fully integrated: checkout session, webhook, payment records
- Payment model supports `provider` field ("manual" | "stripe")
- Currency: KZT (Kazakhstan Tenge)

**Research completed:**
- [x] API docs analyzed: Merchant API (no PCI DSS) — best fit
- [x] Flow: POST `/init_payment.php` → XML `{pg_redirect_url}` → user pays → POST `result_url` callback → XML `{pg_status: ok/rejected}` → redirect success/failure
- [x] Auth: MD5 signature (`pg_sig`) — sort params alphabetically, prepend script name, append secret key, join with `;`, MD5 hash
- [x] Endpoints: `api.freedompay.kz` (prod), `test-api.freedompay.kz` (test)
- [x] Status check: `/get_status3.php`, Refund: `/revoke.php`, Init: `/init_payment.php`
- [x] Test cards: `4111 1111 1111 1111` (success), `4563 9601 2200 1999` (rejected), 3DS password: `12345678`
- [x] No official npm package — custom implementation needed (simple HTTP + MD5)
- [x] Webhook response: XML format, public endpoint required, verify `pg_sig` on callback

**Implementation:**
- [x] Created `src/lib/freedom-pay.ts`:
  - `generateSignature()` / `verifySignature()` — MD5 sig per spec
  - `initPayment()` — create payment, get redirect URL
  - `getPaymentStatus()` — check status via `/get_status3.php`
  - `refundPayment()` — full/partial refund via `/revoke.php`
  - `buildCallbackResponse()` — XML response for result_url callback
  - `isFreedomPayConfigured()` — config check
  - XML parsing helper, XSS-safe escapeXml
- [x] API routes:
  - `POST /api/billing/freedom/checkout` — create pending payment → init with Freedom Pay → return redirect URL
  - `POST /api/billing/freedom/webhook` — verify signature → process result → activate subscription or mark failed
- [x] Payment.provider = "freedom" (no schema change needed — field is String)
- [x] Webhook: signature verification, idempotent (re-process safe), transaction-wrapped subscription activation
- [x] 12 tests: signature generation, verification, param ordering, XML response, XSS escaping
- [ ] Env vars: FREEDOM_PAY_MERCHANT_ID, FREEDOM_PAY_SECRET_KEY, FREEDOM_PAY_API_URL, FREEDOM_PAY_RESULT_URL, etc.
- [ ] Update billing UI: show Freedom Pay button (frontend — later)
- [ ] Full integration test with test credentials (requires merchant account)

**Files:** `src/lib/freedom-pay.ts` (new), `src/app/api/billing/freedom/` (new), `src/app/(app)/billing/page.tsx`, `prisma/schema.prisma`

**Dependencies:** SMTP (#M6) must work for invoice emails. Test credentials needed.

---

### C2. Billing + Usage + Invoice Full Check (#10) [x] DONE (code review + fixes + tests)

**Problem:** End-to-end billing flow verification with Freedom Pay integration.

**Current state:**
- Plans: Free, Pro, Business with different limits
- DailyUsage: tracks messages and tokens per day
- Invoice: `src/lib/invoice.ts` — generates invoice number, sends email
- Subscription cron: `/api/cron/subscriptions` — expires subs, sends reminders

**Bugs found & fixed:**

1. **Freedom Pay webhook missing cache invalidation** — after subscription activation, user's plan cache was stale.
   - Fix: Added `invalidatePlanCache(userId)` call after successful payment (matching Stripe webhook).

2. **Freedom Pay webhook missing invoice email** — Stripe sends invoice email on checkout.session.completed but Freedom Pay didn't.
   - Fix: Added `sendInvoiceEmail()` fire-and-forget after subscription activation.

3. **Freedom Pay webhook missing failure notification** — payment failures were silent.
   - Fix: Added `sendPaymentFailedNotification()` fire-and-forget on pgResult="0".

4. **Freedom Pay checkout missing promo code support** — Stripe checkout applies discounts but Freedom Pay didn't.
   - Fix: Added promo code parsing, plan restriction validation, and amount discount in Freedom Pay checkout.

5. **Promo code planId restriction not validated** — `apply-promo` route ignored `planId` field on PromoCode.
   - Fix: Added planId mismatch check with atomic rollback of usedCount if promo doesn't apply.

6. **email.ts smtp_pass/smtp_password mismatch** — (found in M6) admin settings saves `smtp_password` but email.ts queried `smtp_pass`.
   - Fix: Aligned to `smtp_password`. Also added `smtp_from` to SystemSetting query.

**Verification checklist:**
- [x] Invoice number format: `INV-YYYYMMDD-XXXXX` — tested
- [x] Subscription expiry logic: expiresAt, trialEndsAt, null cases — tested
- [x] Promo code validation: active, inactive, expired, exhausted, unlimited, plan-restricted — tested
- [x] Price discount calculation: 0%, 20%, 50%, 100%, fractional — tested
- [x] Freedom Pay webhook flow: expiry dates, metadata parsing, idempotency — tested
- [x] Reminder dedup: 3-day window, midnight start — tested
- [x] Plan price parsing: numeric, with chars, empty, zero — tested
- [x] 33 billing-flow tests pass
- [ ] Live integration test (requires deploy + Freedom Pay test credentials)
- [ ] Manual QA: admin assign/cancel, revenue dashboard, payment history

**Files:** `src/app/api/billing/freedom/webhook/route.ts`, `src/app/api/billing/freedom/checkout/route.ts`, `src/app/api/billing/apply-promo/route.ts`, `src/lib/email.ts`

**Dependencies:** SMTP (#M6) — DONE, Freedom Pay (#C1) — DONE

---

### C3. AI Cortex with FragmentDB (#2) [!] BLOCKED

**Problem:** Create a universal per-user AI-native knowledge base using FragmentDB.

**Status:** Architecture fully documented in `docs/FRAGMENTDB_PIPELINE.md` (see C5).
Implementation blocked — requires:
1. FragmentDB service (Docker/API) — not yet available
2. Embedding model access (OpenAI or local)
3. Separate development sprint

**What's ready:**
- [x] Architecture documented: pipeline, models, API endpoints, native tool, quotas, monitoring
- [x] UserFile system (M1) provides basic file storage as interim solution
- [x] `read_knowledge` native tool extended to search user files (substring-based)

**What's needed for full implementation:**
- [ ] FragmentDB Docker container or API service
- [ ] Embedding model configuration
- [ ] KnowledgeBase + KnowledgeDocument Prisma models
- [ ] `search_user_knowledge` native tool (semantic search)
- [ ] `/knowledge` page UI
- [ ] Plan-based quotas

**Dependencies:** FragmentDB service, embedding model access.

---

### C4. Advertising in AI Context (#4) [x] DONE (concept)

**Problem:** Design a concept for contextual advertising within AI responses, similar to how major companies plan to monetize AI assistants.

**Deliverable:** `docs/ADVERTISING.md` — comprehensive concept document.

**Contents:**
- [x] Industry overview: Google, Microsoft, Perplexity, Meta approaches
- [x] 4 ad types: Contextual Recommendation, Sponsored Knowledge, Sponsored Suggestions, Banner
- [x] Ad selection pipeline: intent extraction → targeting match → relevance score → threshold → display
- [x] Full Prisma data model: AdCampaign, AdCreative, AdImpression
- [x] Targeting parameters: topics, keywords, locale, planType, timeOfDay, userSegment
- [x] Ethics/UX rules: 7 principles (marking, frequency limit, sensitive topics, premium disable)
- [x] Metrics: CTR, RPM, Fill Rate, Relevance Score, User Satisfaction
- [x] 4-phase roadmap: prototype → admin panel → advertiser cabinet → ML targeting

**Files:** `docs/ADVERTISING.md`

---

### C5. FragmentDB Auto-Update Pipeline (#5) [x] DONE (documentation)

**Problem:** Separate project (FragmentDB) needs nightly pipeline to update data. Plan for per-user business knowledge bases.

**Deliverable:** `docs/FRAGMENTDB_PIPELINE.md` — comprehensive architecture document.

**Contents:**
- [x] Nightly pipeline architecture diagram: Source Monitor → Diff Engine → Re-processor → Notifier
- [x] Component descriptions: hash-based change detection, incremental re-chunking, batch embedding
- [x] Prisma models: KnowledgeBase, KnowledgeDocument (with contentHash, status, chunkCount)
- [x] API endpoints: 8 routes for knowledge management + webhook + health
- [x] Native tool spec: `search_user_knowledge` with knowledgeBaseId filter and topK
- [x] System prompt injection format for knowledge bases
- [x] Per-user quotas by plan: Free (1 base/5 docs/10MB), Pro (5/50/100MB), Business (20/500/1GB)
- [x] Environment variables: FRAGMENTDB_URL, EMBEDDING_MODEL, CHUNK_SIZE, etc.
- [x] Monitoring: 6 Prometheus metrics
- [x] 5-phase roadmap

**Files:** `docs/FRAGMENTDB_PIPELINE.md`

**Dependencies:** FragmentDB project, C3 (AI Cortex) implementation

---

## DOCUMENTATION TASKS (for understanding)

### D1. How Skills, Tools, Plugins Work (#20, #21, #22)

**Documented here for reference — no code changes needed.**

#### Tools
- **What:** Atomic capabilities an agent can use
- **Types:** PROMPT_TEMPLATE (text injection), WEBHOOK (HTTP call), URL (link), FUNCTION (code)
- **Config:** JSON with `prompt`, optional `templates[]` (form templates with fields)
- **Usage:** Agent calls tool → `tool-executor.ts` runs it → result injected into context
- **Admin:** `/admin/tools` — create, edit, assign to agents

#### Skills
- **What:** Specialized knowledge/behavior profiles (like a "mode" for the AI)
- **Content:** `systemPrompt` (injected before global prompt), `citationRules`, `jurisdiction`
- **Generation:** `/api/skills/generate` — LLM generates skill from description
- **Usage:** Selected in chat → prompt prepended → AI behaves per skill rules
- **Admin:** `/admin/skills` — manage system skills
- **User:** Can create own skills (Plan.canUseAdvancedTools)

#### Plugins
- **What:** Bundles of Tools + Skills + MCP Servers (like a "framework")
- **Junction tables:** PluginTool, PluginSkill, PluginMcpServer
- **Usage:** Assign plugin to agent → all its tools/skills/MCPs available
- **Admin:** `/admin/plugins` — create, compose from tools/skills/MCPs
- **Heavy:** Plugins are complex compositions — use sparingly

#### Hierarchy
```
Agent
├── Direct Tools (AgentTool)
├── Direct Skills (via prompt)
├── Direct MCP Servers
└── Plugins (AgentPlugin)
    ├── Plugin Tools (PluginTool)
    ├── Plugin Skills (PluginSkill)
    └── Plugin MCP Servers (PluginMcpServer)
```

`resolveAgentContext()` traverses this hierarchy, deduplicates by ID, returns flat context.

---

## SKIPPED TASKS

| # | Task | Reason |
|---|------|--------|
| 6 | Brandbook | User: "позже займусь" |
| 12 | Refactor/Optimization | User: "пока отложим" |
| 15 | Buh/Fin Agent + MCP | User: "отложим" |

---

## PRIORITY ORDER (Recommended Execution)

### Wave 1 — Quick Wins (1-2 days)
1. **S1** — Hide custom agents (30 min)
2. **S6** — Skills error fix (1 hour)
3. **S2** — Additional context questions (1 hour)
4. **S3** — Admin system prompt (2 hours)

### Wave 2 — User-Facing Features (3-5 days)
5. **S4** — Sanbao facts (4 hours)
6. **M4** — Animated icons (4 hours)
7. **S5** — System prompt admin UI (4 hours)
8. **M5** — Autocompact verification (3 hours)

### Wave 3 — Infrastructure (5-7 days)
9. **M6** — SMTP setup (3 hours)
10. **M3** — Rate limit verification (4 hours)
11. **C1** — Freedom Pay (2-3 days)
12. **C2** — Billing full check (1 day, after C1)

### Wave 4 — Major Features (1-2 weeks)
13. **M1** — MD file system (1 day)
14. **M2** — Kazakh localization Phase 1-2 (3-5 days)
15. **C3** — AI Cortex / FragmentDB (3-5 days)
16. **C4** — Advertising concept (2 days)
17. **C5** — FragmentDB pipeline (documentation, 1 day)

---

## PROGRESS LOG

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-02-17 | HOTFIX2.md | Created | Initial plan with 17 active tasks |
| 2026-02-17 | S1 | DONE | Agent visibility: added `status: APPROVED` check for system agents in `[id]/route.ts` + `conversations/route.ts`. 46 agent tests pass. |
| 2026-02-17 | S6 | DONE | Skills JSON: fallback `{...}` extraction, 4000 char limit, domain focus rule in gen prompt, descriptive errors. 8 new tests pass. |
| 2026-02-17 | S2 | DONE | Clarify questions: expanded rules in SYSTEM_PROMPT — triggers for vague input + exceptions for clear questions. |
| 2026-02-17 | S3 | DONE | Trust framing: added honesty, actuality principles; improved clarify UX. |
| 2026-02-17 | Tests | PASS | 213/213 tests green. Build: OK. |
| 2026-02-17 | S4 | DONE | 25 facts in `sanbao-facts.ts`, `SanbaoFact.tsx` floating card with auto-dismiss, session-based no-repeat. Integrated into ChatArea. |
| 2026-02-17 | M4 | DONE | `SanbaoCompass.tsx` SVG compass with idle/loading/thinking/found states. Replaced Triangle in Sidebar header. |
| 2026-02-17 | S5 | DONE | `system_prompt_global` added to SystemSetting whitelist. `getGlobalSystemPrompt()` with 60s cache in route.ts. Admin can override via /admin/settings. |
| 2026-02-17 | Wave 2 | PASS | 213/213 tests. Build: OK. |
| 2026-02-17 | M5 | DONE | 25 context tests: estimateTokens, checkContextWindow, splitMessages, buildSystemPrompt, buildCompactionPrompt |
| 2026-02-17 | M3 | DONE | 10 rate-limit tests (in-memory fallback), 16 billing/usage tests (plan limits, feature gates, admin bypass, expiry) |
| 2026-02-17 | S4+ | DONE | 6 sanbao-facts tests (count, content, Russian, getRandomFact logic) |
| 2026-02-17 | Wave 3 | PASS | **270/270 tests. Build: OK.** Total new tests: +57 |
| 2026-02-17 | M1 | DONE | UserFile model, 5 API routes, read_knowledge extended for user files, system prompt injection, 15 tests. DB push pending deploy. |
| 2026-02-17 | C1 research | DONE | Freedom Pay API fully documented: endpoints, auth (MD5), flow, test cards, webhook format. No npm pkg — custom impl needed. |
| 2026-02-17 | Wave 4 start | PASS | **285/285 tests.** Total new tests: +72 |
| 2026-02-17 | M2 Ph1 | DONE | i18n infra: `i18n.ts`, ru.json (80+ keys), kk.json (full), useTranslation hook, locale API, User.locale field. 12 tests. |
| 2026-02-17 | C1 impl | DONE | `freedom-pay.ts` client library (sig, init, status, refund, callback XML), checkout + webhook API routes, 12 tests. |
| 2026-02-17 | C4 | DONE | `docs/ADVERTISING.md` — full concept: 4 ad types, pipeline, data model, ethics rules, roadmap. |
| 2026-02-17 | C5 | DONE | `docs/FRAGMENTDB_PIPELINE.md` — architecture: pipeline, models, API, native tool, quotas, monitoring. |
| 2026-02-17 | All tests | PASS | **309/309 tests.** Total new tests: +96 |
| 2026-02-17 | M6 | DONE | Gmail SMTP configured (.env), fixed `smtp_pass`→`smtp_password` mismatch in email.ts, added `smtp_from` to SystemSetting query, cached `from` address. Build: OK. |
| 2026-02-17 | C2 | DONE | 6 bugs fixed: FP webhook cache invalidation + invoice email + failure notification, FP checkout promo codes, promo planId validation, email.ts key mismatch. 33 billing-flow tests. |
| 2026-02-17 | **FINAL** | PASS | **342/342 tests. Build: OK.** Total new tests: +129. All 16 actionable tasks complete. C3 blocked on FragmentDB service. |

---

## NEXT STEPS (backlog for future sprints)

### Frontend / UI (высокий приоритет)

| # | Задача | Из | Описание |
|---|--------|----|----------|
| F1 | UI "Мои файлы" | M1 | Страница в `/settings` или `/profile`: список файлов, создание/редактирование MD, удаление с подтверждением |
| F2 | Казахский язык в UI | M2 Ph2 | Интеграция `useTranslation()` в Sidebar, ChatArea, Settings, Login, Billing + переключатель языка |
| F3 | Кнопка Freedom Pay | C1 | Добавить вариант оплаты через Freedom Pay на странице `/billing` |
| F4 | Admin System Prompt | S5 | Textarea для редактирования глобального system prompt в `/admin/settings` + кнопка "Reset to Default" |
| F5 | Компас в ThinkingIndicator | M4 | Заменить иконку при agentId=sanbao, splash screen, `prefers-reduced-motion` |

### Ops / Инфраструктура

| # | Задача | Из | Описание |
|---|--------|----|----------|
| O1 | DNS записи | M6 | Настроить SPF, DKIM, DMARC для домена sanbao.ai (почтовая доставляемость) |
| O2 | Live-тест платежей | C2 | Тестовые карты Freedom Pay (`4111 1111 1111 1111`, 3DS: `12345678`) |
| O3 | FragmentDB сервис | C3 | Развернуть Docker, настроить embedding model, реализовать knowledge base API |
| O4 | Prisma DB push | M1+M2 | `npx prisma db push` — применить UserFile модель и User.locale поле |

### QA / Ручное тестирование

| # | Задача | Из | Описание |
|---|--------|----|----------|
| Q1 | Кларификация | S2 | Тест с размытыми промптами: "напиши документ", "помоги с работой" |
| Q2 | Генерация навыков | S6 | Тест навыка "юрист по ГК РФ" — проверить отсутствие cross-domain contamination |
| Q3 | Autocompact | M5 | 20+ сообщений → проверить создание ConversationSummary в БД |
| Q4 | Промокоды | C2 | Применить промокод → checkout → убедиться что сумма скорректирована |

### Отложенные задачи (skipped)

| # | Задача | Причина |
|---|--------|---------|
| 6 | Brandbook | "позже займусь" |
| 12 | Refactor/Optimization | "пока отложим" |
| 15 | Buh/Fin Agent + MCP | "отложим" |
