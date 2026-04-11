<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-000?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql" />
  <img src="https://img.shields.io/badge/Tests-Vitest-6E9F18?style=for-the-badge&logo=vitest" />
</p>

<h1 align="center">sanbao</h1>

<h3 align="center">
  B2B SaaS AI-assistant for legal, customs, accounting professionals in Kazakhstan<br/>
  Powered by LeemaDB vector database + Orchestrator MCP server
</h3>

<p align="center">
  <b>39K LOC TypeScript</b> &bull; <b>134 API routes</b> &bull; <b>42 pages</b> &bull; <b>115 components</b><br/>
  <b>68 Prisma models</b> &bull; <b>15 Zustand stores</b> &bull; <b>4 AI agents</b>
</p>

---

## What is sanbao?

sanbao is the **B2B SaaS frontend and API** for an AI knowledge platform designed for legal, customs, and accounting professionals in Kazakhstan.

**Key features:**
- 🤖 **4 AI agents:** Lawyer, Customs Broker, Accountant, 1С Platform Consultant
- 💬 **Streaming chat interface** with real-time AI responses
- 🎯 **MCP integration** — dynamically discovers and calls 25+ tools from LeemaDB/Orchestrator
- 📚 **Document management** — upload, process, search PDFs, Word docs, spreadsheets
- 💳 **Billing & subscriptions** — Stripe + Freedom Pay integration
- 🔐 **Enterprise auth** — OAuth (Google), email/password, 2FA for admins
- 📊 **Admin panel** — user management, analytics, experiments, audit logs

**sanbao is powered by:**
- **LeemaDB** (Rust vector database) — 38K LOC, 450 tests, hybrid search (vector + full-text + graph)
- **Orchestrator** (Python MCP server) — 16.6K LOC, 800 tests, document pipeline, NL-to-SQL

---

## Quick Start

### Local Development

**1. Clone and install:**

```bash
cd sanbao
cp .env.example .env
npm install
```

**2. Set required environment variables:**

```bash
# .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sanbao
REDIS_URL=redis://localhost:6379/0
AUTH_SECRET=<base64-encoded-jwt-secret>
ENCRYPTION_KEY=<base64-encoded-aes-key>
KIMI_API_KEY=sk-...  # Moonshot Kimi LLM
```

**3. Start database + cache (Docker):**

```bash
docker compose up -d
```

**4. Initialize database:**

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

**5. Open browser:**

```
http://localhost:3004
```

### Docker (Full Stack)

To run the entire SANBAO platform locally (sanbao + Orchestrator + LeemaDB):

```bash
# From project root
cd sanbao

# Terminal 1: Database + Cache
docker compose up -d

# Terminal 2: LeemaDB
cd ../ai_cortex
cargo run -p ldb-server -- --host 0.0.0.0 --port 8110

# Terminal 3: Orchestrator
export LEEMADB_URL=http://localhost:8110
python -m orchestrator --http

# Terminal 4: sanbao
cd ../sanbao
npm run dev

# Test
curl http://localhost:3004/api/ready
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                          # User pages (13 routes)
│   │   ├── chat/                       # /chat, /chat/[id]
│   │   │   ├── page.tsx                # Chat interface (streaming)
│   │   │   ├── [id]/page.tsx           # Conversation history
│   │   │   └── ...
│   │   ├── agents/                     # /agents, /agents/[id]
│   │   ├── skills/                     # /skills, /skills/[id]
│   │   ├── profile/, settings/, billing/
│   │   └── mcp/                        # MCP server management
│   │
│   ├── (auth)/                         # Auth pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── (admin)/admin/                  # Admin panel (29 routes)
│   │   ├── users/                      # User management
│   │   ├── models/                     # LLM model management
│   │   ├── tools/                      # MCP tool CRUD
│   │   ├── agents/, skills/            # Agent/skill management
│   │   ├── organizations/              # Org management
│   │   ├── billing/, audit-log/        # Billing, audit trail
│   │   └── ...
│   │
│   ├── (legal)/                        # Legal pages
│   │   ├── terms/
│   │   ├── privacy/
│   │   └── offer/
│   │
│   ├── api/                            # **134 API route files**
│   │   ├── auth/                       # NextAuth + OAuth
│   │   ├── chat/                       # Streaming chat endpoint + helpers
│   │   │   ├── route.ts                # Main endpoint (NDJSON streaming)
│   │   │   ├── validate.ts             # Zod validation
│   │   │   ├── agent-resolver.ts       # Agent context loading
│   │   │   ├── context-loader.ts       # Conversation history
│   │   │   └── ...
│   │   ├── agents/                     # Agent CRUD + knowledge base
│   │   ├── skills/                     # Skill management
│   │   ├── tools/                      # Tool CRUD + search
│   │   ├── mcp/                        # MCP discovery + tool calling
│   │   ├── documents/                  # File upload + processing
│   │   ├── conversations/              # Conversation history
│   │   ├── artifacts/                  # Code/doc artifacts
│   │   ├── billing/                    # Stripe, subscription management
│   │   ├── admin/                      # Admin API routes (~50)
│   │   ├── health.ts, ready.ts         # Health checks
│   │   └── ...
│   │
│   ├── layout.tsx                      # Root layout
│   ├── not-found.tsx                   # 404 page
│   └── error.tsx                       # Error boundary
│
├── components/                         # **115 UI components** (17 dirs)
│   ├── ui/                             # shadcn/ui primitives
│   │   ├── button, input, dialog, etc. # Headless components
│   ├── admin/                          # Admin-specific
│   │   ├── UserManagementTable, BillingDashboard, etc.
│   ├── agents/                         # Agent management
│   │   ├── AgentSelector, SkillBuilder, etc.
│   ├── chat/                           # Chat interface
│   │   ├── ChatInput, MessageBubble, StreamingResponse, etc.
│   ├── artifacts/                      # Artifact viewer/editor
│   │   ├── CodeArtifact, DocumentArtifact, etc.
│   ├── billing/                        # Billing components
│   │   ├── SubscriptionSelector, PricingTable, etc.
│   ├── memory/                         # Memory management
│   ├── skills/, tasks/, etc.
│   └── ...
│
├── lib/
│   ├── ai-cortex-client.ts             # Orchestrator HTTP client
│   │   └── callMcpTool(), getPipeline(), etc.
│   ├── model-router.ts                 # LLM provider selection
│   │   └── routeToModel(): selects Kimi/OpenAI/Claude/etc
│   ├── redis.ts                        # Redis client + error handling
│   ├── db.ts                           # Prisma client singleton
│   ├── auth.ts                         # NextAuth configuration
│   ├── middleware.ts                   # Auth, rate limit middleware
│   ├── constants.ts                    # App-wide constants
│   ├── utils/                          # Utility functions
│   │   ├── format.ts, parse.ts, etc.
│   └── hooks.ts                        # Custom React hooks
│
├── middleware.ts                       # Next.js edge middleware
│   └── Auth check, locale detection
│
├── stores/                             # **15 Zustand state stores**
│   ├── chat-store.ts                   # Chat state (messages, streaming)
│   ├── artifact-store.ts               # Artifact display state
│   ├── agent-store.ts                  # Selected agent + config
│   ├── skill-store.ts                  # Active skills
│   ├── memory-store.ts                 # Memory/brain state
│   ├── task-store.ts                   # Task list state
│   ├── billing-store.ts                # Subscription state
│   ├── org-store.ts                    # Organization context
│   └── ...
│
├── styles/
│   ├── globals.css                     # Global Tailwind + custom
│   └── animations.ts                   # Framer Motion presets
│
├── .env.example
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── vitest.config.ts

public/                                 # Static assets
├── images/
└── ...

scripts/
├── deploy.sh                           # Production deployment
└── ...

tests/                                  # Integration tests
└── ...

docker-compose.yml                      # Local dev (DB + Cache only)
Dockerfile                              # Production multi-stage build
.env.example                            # Environment template
CLAUDE.md                               # Implementation details
ARCHITECTURE.md                         # Architecture deep dive
```

---

## Commands

### Development

```bash
# Start dev server (:3004)
npm run dev

# Build for production
npm run build

# Lint with ESLint
npm run lint

# Type check with TypeScript
npm run type-check

# Run tests (vitest)
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Database

```bash
# Create & apply migration
npx prisma migrate dev --name <description>

# Deploy migrations (production)
npx prisma migrate deploy

# Sync schema
npx prisma db push

# Regenerate Prisma client
npx prisma generate

# Visual DB browser (:5555)
npx prisma studio

# Seed database (plans, agents, tools, models)
npx prisma db seed
```

### Docker

```bash
# Start local services (PostgreSQL + Redis)
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs postgres -f

# Production deployment
./scripts/deploy.sh app         # Rolling restart
./scripts/deploy.sh full        # Full rebuild
./scripts/deploy.sh cortex      # Rebuild ai_cortex stack
```

---

## Architecture Overview

### Request Flow

```
User → Browser
    ↓
React SPA (/chat)
    │ User types message
    ↓
POST /api/chat (NDJSON streaming)
    ├─ Authenticate (JWT)
    ├─ Load conversation history (PostgreSQL)
    ├─ Resolve agent (Zustand + Prisma)
    ├─ Select LLM (model-router: Kimi/Claude/etc)
    ├─ Fetch MCP tools (Orchestrator discovery)
    ├─ Call LLM with tools
    │  └─ Stream response (NDJSON lines)
    │     Each line: {t: "c/r/p/s/x", v: "content"}
    ├─ On tool call → Orchestrator /mcp/{domain}
    │  └─ Orchestrator → LeemaDB search
    │     └─ Return results to LLM
    │        └─ LLM incorporates into response
    ├─ Stream final response to browser
    └─ Save Message + Artifacts (PostgreSQL)
        ├─ TokenLog (for billing)
        └─ Cache invalidation (Redis)
```

### Chat Streaming Format

**NDJSON (newline-delimited JSON):**

```
{"t":"s","v":"Analyzing your question..."}
{"t":"c","v":"According to the Tax Code,"}
{"t":"c","v":" the VAT rate is 12%"}
{"t":"r","v":"I searched legal_kz collection"}
{"t":"x","v":"Found: Article 103 of Tax Code"}
{"t":"e","v":"null"}
```

**Event types:**
- `t="c"` — content (part of LLM response)
- `t="r"` — reasoning (why model did something)
- `t="p"` — plan (multi-step thinking)
- `t="s"` — status (searching, processing)
- `t="x"` — context (documents retrieved)
- `t="e"` — end (stream complete, error or success)

### Component Hierarchy

```
<RootLayout>
  <Nav>
  <Sidebar>
  <Routes>
    <ChatPage>
      <ChatMessages>
        <Message>
          <MessageBubble>
            <StreamingContent>
      <ChatInput>
        <AgentSelector>
        <SkillSelector>
        <AttachmentUpload>
    <AdminPage>
      <AdminNav>
      <Users | Models | Tools | Agents | Billing>
```

---

## API Routes

### Chat Routes

```
POST   /api/chat                        # Main streaming endpoint
POST   /api/conversations               # Create conversation
GET    /api/conversations               # List conversations
GET    /api/conversations/[id]          # Get conversation + history
PUT    /api/conversations/[id]          # Update conversation
DELETE /api/conversations/[id]          # Delete conversation
POST   /api/conversations/[id]/messages # Add message
POST   /api/artifacts                   # Create artifact
PUT    /api/artifacts/[id]              # Update artifact
DELETE /api/artifacts/[id]              # Delete artifact
```

### Agent Routes

```
GET    /api/agents                      # List agents
POST   /api/agents                      # Create agent
GET    /api/agents/[id]                 # Get agent details
PUT    /api/agents/[id]                 # Update agent
DELETE /api/agents/[id]                 # Delete agent
POST   /api/agents/[id]/knowledge-base  # Add KB document
```

### MCP Integration Routes

```
GET    /api/mcp/tools                   # Discover all tools
POST   /api/mcp/tools/search            # Search tools
POST   /api/mcp/call                    # Call tool directly
GET    /api/mcp/domains                 # List available domains
POST   /api/mcp/servers                 # Register MCP server
```

### Billing Routes

```
GET    /api/billing/plans               # List subscription plans
POST   /api/billing/subscribe           # Subscribe to plan
POST   /api/billing/stripe/webhook      # Stripe webhook
GET    /api/billing/usage               # Get token usage
GET    /api/billing/invoices            # Get invoices
```

### Admin Routes

```
GET    /api/admin/users                 # List users
POST   /api/admin/users/[id]/disable    # Disable user
GET    /api/admin/analytics             # Aggregate stats
GET    /api/admin/audit-log             # Audit trail
POST   /api/admin/settings              # Update system settings
```

---

## Data Models (Prisma)

**Key relationships:**

```
User → Conversation → Message → Artifact
       → Agent
       → Subscription → Payment
       → TokenLog (for billing)

Agent → AgentTool (many-to-many with Tool)
     → AgentSkill (many-to-many with Skill)
     → AgentMcpServer (many-to-many with MCP server)

Organization → User → all above
            → Subscription
            → AuditLog
```

**68 models total:**
- Core: User, Conversation, Message, Artifact
- Agents: Agent, Tool, Skill, Plugin
- MCP: McpServer, McpTool, McpToolLog
- Billing: Subscription, SubscriptionPlan, Payment, TokenLog
- Admin: AuditLog, SystemSetting, AdminUser

See **`CLAUDE.md`** for full schema details.

---

## State Management (Zustand)

**15 stores for different concerns:**

```typescript
// Chat state
const chatStore = useChatStore((s) => s.messages);

// Agent selection
const { selectedAgent } = useAgentStore();

// Skills
const { activeSkills } = useSkillStore();

// Artifacts
const { artifacts, selectedArtifact } = useArtifactStore();

// Billing
const { subscription } = useBillingStore();
```

Benefits:
- **Type-safe** — Full TypeScript support
- **Reactive** — Components re-render on store changes
- **Composable** — Combine multiple stores
- **Dev tools** — Redux DevTools support

---

## Testing

### Unit Tests

```bash
npm test                        # Run all tests
npm test -- --watch            # Watch mode
npm test -- --coverage         # Coverage report
npm test components/           # Single directory
```

**Test structure:**

```typescript
// src/components/__tests__/ChatInput.test.tsx
import { render, screen } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('should submit message on enter', () => {
    // Test implementation
  });
});
```

### Integration Tests

Located in `tests/`:
```bash
npm run test:integration
```

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/sanbao

# Cache
REDIS_URL=redis://localhost:6379/0

# Auth
AUTH_SECRET=<base64-encoded-jwt-secret>    # NextAuth JWT secret
ENCRYPTION_KEY=<base64-encoded-aes-key>    # AES-256-GCM for API keys

# AI Models
KIMI_API_KEY=sk-...                        # Moonshot Kimi (primary)
DEEPINFRA_API_KEY=sk-...                   # Embeddings + fallback LLM
```

### Optional

```bash
# Additional LLM providers
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FREEDOM_PAY_API_KEY=...

# Observability
SENTRY_DSN=https://...
NODE_ENV=production
HOSTNAME=0.0.0.0

# External APIs
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Deployment

### Production

Deployment is managed from the sanbao root:

```bash
./scripts/deploy.sh app         # Rolling restart (fastest, zero downtime)
./scripts/deploy.sh full        # Full rebuild
./scripts/deploy.sh status      # Check status
./scripts/deploy.sh logs app    # View logs
```

**Strategy:**
- 3 app replicas (docker-compose.prod.yml)
- nginx load balancer with ip_hash (sticky sessions)
- Rolling restart: stop 1 replica, drain traffic, restart
- Result: 2/3 replicas always serving, zero downtime

### Pre-deploy Checklist

- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting issues: `npm run lint`
- [ ] No uncommitted changes: `git status`
- [ ] Main branch up-to-date: `git pull origin main`
- [ ] Migrations applied: `npx prisma migrate deploy`

---

## Performance Tips

### Frontend

- **Code splitting:** Pages auto-split via Next.js
- **Image optimization:** `<Image>` from next/image
- **CSS in JS:** Tailwind with tree-shaking
- **State batching:** Zustand batching for multiple updates
- **API caching:** TanStack Query with revalidation

### Backend

- **Query optimization:** Prisma `select()` to avoid over-fetching
- **Connection pooling:** PgBouncer (25 per user, 1000 max)
- **Result caching:** Redis for agent metadata, tools, rates
- **Rate limiting:** 30 req/s per IP, 50 burst

### Database

- **Indexes:** userId, createdAt, agentId
- **Soft deletes:** Use `deletedAt` nullable timestamp
- **Pagination:** Limit 100, cursor-based for large results

---

## Troubleshooting

### "Cannot find module 'prisma'"

```bash
npx prisma generate
npm install
```

### Redis connection refused

```bash
docker compose up redis -d
# or
redis-server
```

### Database locked

```bash
docker compose restart postgres
# Check connection pool
docker compose logs postgres | grep "connection"
```

### Chat endpoint returns 401

```bash
# Check JWT
curl -H "Authorization: Bearer $TOKEN" http://localhost:3004/api/chat

# Verify AUTH_SECRET in .env
echo $AUTH_SECRET
```

---

## Contributing

1. **Create feature branch:** `git checkout -b feature/your-feature`
2. **Make changes** — follow code style (ESLint, Prettier)
3. **Test:** `npm test`, `npm run type-check`, `npm run lint`
4. **Commit:** `git commit -m "feat: your change"`
5. **Push:** `git push origin feature/your-feature`
6. **PR:** Create pull request, wait for review

**Code style:**
- TypeScript strict mode
- ESLint enforces rules
- Prettier formats code
- Tailwind CSS for styling
- No `any` types

---

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| **CLAUDE.md** | Developers | Implementation details, API structure, Prisma schema |
| **ARCHITECTURE.md** | Architects | Component design, data flow, patterns |
| **../CLAUDE.md** | DevOps | Infrastructure, deployment, failover |
| **../ARCHITECTURE.md** | Full team | System architecture, integration points |

---

## Support & Feedback

- **Questions:** Check `CLAUDE.md` implementation guide
- **Issues:** GitHub Issues (internal)
- **Slack:** #sanbao-dev

---

<p align="center">
  <b>Built with modern React patterns and production-grade reliability.</b><br/>
  <i>Every component is tested, every API is documented, every change is audited.</i>
</p>
