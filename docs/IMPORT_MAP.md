# Sanbao Import Dependency Map

> Generated: 2026-03-09 | Phase 0.2 Audit

## Module Classification

### Server-only (41 modules) — Stay in apps/web

| Module | Server-only deps |
|--------|-----------------|
| `prisma.ts` | `@prisma/client`, `@prisma/extension-read-replicas` |
| `auth.ts` | `next-auth`, `bcryptjs`, `crypto` (node), prisma |
| `redis.ts` | `ioredis` |
| `queue.ts` | `bullmq`, redis |
| `workers.ts` | queue (bullmq) |
| `shutdown.ts` | redis, queue, mcp-client, settings |
| `email.ts` | `nodemailer`, prisma |
| `storage.ts` | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| `stripe-client.ts` | `stripe` |
| `crypto.ts` | `crypto` (node) |
| `mcp-client.ts` | `@modelcontextprotocol/sdk`, prisma |
| `mobile-auth.ts` | `jose` |
| `mobile-session.ts` | `@auth/core/jwt`, redis |
| `parse-file.ts` | `pdf-parse`, `mammoth`, `xlsx`, `officeparser` |
| `correlation.ts` | `node:async_hooks` |
| `ssrf.ts` | `dns` (node) |
| `audit.ts` | prisma |
| `admin.ts` | auth, prisma, rate-limit |
| `admin-crud-factory.ts` | admin, prisma |
| `api-helpers.ts` | auth (next-auth) |
| `auth-utils.ts` | prisma, mobile-session, crypto |
| `settings.ts` | prisma, redis |
| `prompts.ts` | prisma |
| `model-router.ts` | prisma, crypto |
| `ab-experiment.ts` | prisma |
| `content-filter.ts` | prisma |
| `context.ts` | prompts (prisma transitive) |
| `memory.ts` | context (prisma transitive) |
| `rate-limit.ts` | redis |
| `usage.ts` | prisma, redis |
| `tool-resolver.ts` | prisma, redis |
| `slugify.ts` | prisma |
| `org-auth.ts` | prisma |
| `org-limits.ts` | prisma, usage |
| `invoice.ts` | prisma, email |
| `subscription-manager.ts` | prisma, invoice |
| `webhook-dispatcher.ts` | prisma, ssrf |
| `llm-generate.ts` | model-router (prisma transitive) |
| `freedom-pay.ts` | crypto (node), logger |
| `logger.ts` | correlation (node:async_hooks) |
| `request-metrics.ts` | bounded-map (pure, but server-only usage) |

### Client-safe (15 modules) → packages/shared or packages/ui

| Module | Destination | Used by components | Used by API |
|--------|------------|-------------------|-------------|
| `utils.ts` | `@sanbao/shared` | 55+ components | 1 route |
| `constants.ts` | `@sanbao/shared` | 15+ components | 24 routes |
| `animations.ts` | `@sanbao/shared` | 3 components | no |
| `api-client.ts` | stays in web | 4 admin pages | no |
| `bounded-map.ts` | `@sanbao/shared` | no | transitive |
| `i18n.ts` | `@sanbao/shared` | via hook | no |
| `panel-actions.ts` | `@sanbao/ui` | 4 components | no |
| `parse-message-content.ts` | `@sanbao/shared` | 2 components | no |
| `code-preview-builder.ts` | `@sanbao/ui` | 1 component | no |
| `export-utils.ts` | `@sanbao/shared` | 2 components | no |
| `export-docx.ts` | `@sanbao/ui` | via export | no |
| `export-pdf.ts` | `@sanbao/ui` | via export | no |
| `export-xlsx.ts` | `@sanbao/ui` | via export | no |
| `csv-utils.ts` | `@sanbao/shared` | no | 3 routes |
| `validation.ts` | `@sanbao/shared` | no | 27 routes |
| `chat/tool-categories.ts` | `@sanbao/shared` | 1 component | no |
| `markdown-components.tsx` | `@sanbao/ui` | 1 component | no |
| `types/mcp.ts` | `@sanbao/shared` | no | transitive |

### Mixed (need splitting)

Only `constants.ts` has true mixed content (UI + server constants). Current approach: keep unified in shared, server-only consumers import from same source.

## Store Dependencies

All 14 stores are clean — zero server-only imports. Safe for packages/stores.

## Circular Dependencies

**None found.** Dependency graph is acyclic (DAG).

## Architecture Notes

1. No server-only leaks into components or stores
2. `panel-actions.ts` creates `lib/ → stores/` dependency — belongs in packages/ui
3. `markdown-components.tsx` in lib/ imports from components/ — architectural smell, belongs in packages/ui
4. `settings-registry.ts` and `bounded-map.ts` are pure TS with zero deps
