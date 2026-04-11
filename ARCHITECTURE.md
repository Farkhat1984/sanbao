# sanbao — Application Architecture

> Deep technical reference for the sanbao B2B SaaS application architecture, component design, data flows, and implementation patterns.

For system-wide architecture (including ai_cortex integration), see **`../ARCHITECTURE.md`**

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Layer Architecture](#layer-architecture)
3. [Chat Streaming Architecture](#chat-streaming-architecture)
4. [State Management](#state-management)
5. [Database Schema & ORM](#database-schema--orm)
6. [API Design Patterns](#api-design-patterns)
7. [Authentication & Authorization](#authentication--authorization)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Testing Strategy](#testing-strategy)

---

## Application Overview

### Three Main Sections

```
User
 │
 ├─► Chat Interface (/chat, /chat/[id])
 │   ├─ Real-time streaming responses
 │   ├─ Agent selection dropdown
 │   ├─ Skill builder
 │   └─ Artifact viewer
 │
 ├─► User Management (/agents, /skills, /profile, /billing)
 │   ├─ Agent configuration
 │   ├─ Custom skills
 │   ├─ Account settings
 │   └─ Subscription management
 │
 └─► Admin Panel (/admin/*, 2FA required)
     ├─ User management
     ├─ Model management
     ├─ Tool/MCP server CRUD
     ├─ Analytics & experiments
     └─ Audit logs
```

### Key Constraints

- **Stateless frontend** — All state in PostgreSQL + Redis (not localStorage)
- **NDJSON streaming** — Chat responses sent as line-delimited JSON (not Server-Sent Events)
- **MCP delegation** — All AI tool calls go through Orchestrator
- **Database-driven** — User preferences, agents, skills all stored in PostgreSQL

---

## Layer Architecture

### Presentation Layer (React Components)

```
src/app/
├── (app)/                  ← Authenticated pages (user routes)
│   ├── chat/page.tsx       ← Main chat interface (streaming)
│   ├── agents/page.tsx     ← Agent management
│   ├── skills/page.tsx     ← Skill builder
│   ├── profile/, billing/  ← User settings
│   └── ...
├── (auth)/                 ← Public auth pages
│   ├── login/page.tsx
│   └── register/page.tsx
└── (admin)/admin/          ← Admin-only pages (role + 2FA check)
    ├── users/page.tsx
    ├── models/page.tsx
    └── ...

src/components/
├── ui/                     ← shadcn/ui primitives (headless)
│   ├── button, input, dialog, sidebar, etc.
├── chat/                   ← Chat-specific components
│   ├── ChatMessages.tsx    ← Message list with streaming
│   ├── ChatInput.tsx       ← Input box + agent selector
│   ├── MessageBubble.tsx   ← Single message rendering
│   └── StreamingContent.tsx ← Real-time response display
├── agents/                 ← Agent components
│   ├── AgentSelector.tsx   ← Dropdown for agent selection
│   ├── AgentCard.tsx       ← Agent preview card
│   └── AgentEditor.tsx     ← Create/edit agent
├── artifacts/              ← Artifact viewer/editor
│   ├── CodeArtifact.tsx    ← Code block with syntax highlighting
│   ├── DocumentArtifact.tsx ← Rendered document
│   └── ArtifactEditor.tsx  ← In-browser editor
├── admin/                  ← Admin-specific
│   ├── UserTable.tsx       ← User management grid
│   ├── BillingDashboard.tsx ← Billing analytics
│   └── AuditLog.tsx        ← Audit trail viewer
└── ...
```

**Key principle:** Components are **presentational** (dumb), all state logic in Zustand stores + React Query.

### API Layer (Next.js Routes)

```
src/app/api/

chat/
├── route.ts               ← POST /api/chat (streaming NDJSON)
├── validate.ts            ← Zod schemas for request/response
├── agent-resolver.ts      ← Load agent config + MCP tools
├── context-loader.ts      ← Load conversation history
└── utils/
    ├── moonshot-stream.ts ← Kimi K2.5 streaming
    ├── ai-sdk-stream.ts   ← OpenAI/Claude via Vercel SDK
    └── message-builder.ts ← Build LLM prompt

agents/, skills/, tools/  ← CRUD endpoints (standard REST)

mcp/
├── tools/search           ← Search MCP tools by query
├── tools/call             ← Call tool directly
└── [domain]/call          ← Call tool in specific domain

conversations/            ← Conversation history

artifacts/                ← Artifact storage + retrieval

billing/                  ← Stripe, subscription endpoints

admin/                    ← Admin API (50+ routes)
├── users/, models/, tools/, etc.

health.ts, ready.ts       ← Health check endpoints
```

### Service Layer (lib/)

```
lib/

ai-cortex-client.ts       ← HTTP client for Orchestrator
├── async callMcpTool(domain, tool, args)
├── async getPipelineStatus(projectId)
└── async uploadDocument(file, projectId)

model-router.ts           ← LLM provider selection logic
├── routeToModel(model, fallbacks)
└── selectBestProvider(latency, cost, capabilities)

redis.ts                  ← Redis client wrapper
├── Graceful degradation (null response if unavailable)
├── Session caching
└── Rate limiter tracking

db.ts                     ← Prisma client singleton
├── Connect to PostgreSQL
└── Enable logging in dev

auth.ts                   ← NextAuth configuration
├── JWT secret
├── OAuth providers
├── Session callback

middleware.ts             ← Auth + rate limiting middleware
├── Check JWT token
├── Rate limit per IP
└── Inject user context

constants.ts              ← App-wide constants
├── LLM models
├── Default prompts
└── Feature flags

utils/
├── format.ts             ← Text formatting (markdown, code)
├── parse.ts              ← Parse LLM responses
└── validate.ts           ← Data validation helpers

hooks.ts                  ← Custom React hooks
├── useAuth()
├── useChat()
├── useBillingInfo()
└── ...
```

### State Management Layer (Zustand)

```
stores/

chat-store.ts             ← Chat state
├── messages: Message[]
├── streamingResponse: string
├── isLoading: boolean
└── setMessage(), addMessage(), clearChat()

agent-store.ts            ← Agent selection
├── selectedAgent: Agent | null
├── agents: Agent[]
└── selectAgent(), loadAgents()

artifact-store.ts         ← Artifact display
├── artifacts: Artifact[]
├── selectedArtifact: Artifact | null
└── openArtifact(), updateArtifact()

skill-store.ts            ← Active skills
├── activeSkills: string[]
├── availableSkills: Skill[]
└── toggleSkill()

memory-store.ts           ← Memory/brain
├── memory: MemoryItem[]
├── isSearching: boolean
└── addMemory(), searchMemory()

billing-store.ts          ← Subscription state
├── subscription: Subscription | null
├── tokenUsage: number
├── quota: number
└── checkQuota()

org-store.ts              ← Organization context
├── organization: Organization | null
└── switchOrg()

ui-store.ts               ← UI state (sidebar, etc)
├── isSidebarOpen: boolean
└── toggleSidebar()
```

### Data Access Layer (Prisma + TanStack Query)

```
Prisma ORM
├── Compiled type-safe queries
├── Automatic relation loading
└── Migration management

TanStack Query (React Query)
├── Server state cache
├── Automatic refetching
├── Background sync
└── Optimistic updates
```

---

## Chat Streaming Architecture

### Request Flow

```
User types in ChatInput
    │
    ├─ On submit: POST /api/chat
    │  {
    │    conversationId: "conv_123",
    │    message: "What's the VAT rate?",
    │    agentId: "lawyer_bot",
    │    mode: "streaming"
    │  }
    │
    ├─ POST /api/chat handler (route.ts)
    │  1. Authenticate user (JWT from cookies)
    │  2. Validate request (Zod schema)
    │  3. Load conversation history (Prisma, last 10 messages)
    │  4. Resolve agent (Zustand + Prisma)
    │  5. Fetch MCP tools (call Orchestrator)
    │  6. Build system prompt + context
    │  7. Call LLM with streaming enabled
    │
    ├─ Response Stream (NDJSON)
    │  Each line is a complete JSON object:
    │  {"t":"s","v":"Searching legal database..."}
    │  {"t":"c","v":"According to the Tax Code,"}
    │  {"t":"c","v":" the VAT rate is 12%"}
    │  (more lines...)
    │  {"t":"e","v":"null"}
    │
    └─ Post-stream processing
       1. Save Message to PostgreSQL
       2. Save Artifacts (if created)
       3. Update TokenLog (for billing)
       4. Invalidate cache
       5. Update Zustand store
```

### NDJSON Format

**Why NDJSON (not Server-Sent Events)?**
- No framing overhead
- Simpler client parsing
- Works with standard HTTP/2 streams
- Browser `fetch()` can read incrementally

**Event types:**
```typescript
type StreamEvent = 
  | { t: "c"; v: string }           // "content" - LLM response
  | { t: "r"; v: string }           // "reasoning" - why model did something
  | { t: "p"; v: string }           // "plan" - multi-step thinking
  | { t: "s"; v: string }           // "status" - searching, processing
  | { t: "x"; v: string }           // "context" - retrieved documents
  | { t: "e"; v: string | null }    // "end" - stream complete (error or null)
```

**Client-side parsing:**

```typescript
async function* parseNDJSON(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line);
      }
    }
  }
}
```

### Tool Calling Flow

```
LLM returns response with embedded tool calls:
{
  "type": "tool-use",
  "id": "tool_123",
  "name": "search",
  "input": {"query": "VAT rate", "domain": "legal_kz"}
}

sanbao handler:
1. Parse tool call from LLM response
2. Validate tool exists in agent config
3. Call Orchestrator:
   POST /mcp/legal_kz
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "search",
       "arguments": {"query": "VAT rate"}
     }
   }
4. Orchestrator calls LeemaDB (hybrid search)
5. Orchestrator returns results
6. Send tool result back to LLM:
   {
     "type": "tool-result",
     "tool_use_id": "tool_123",
     "content": [{"type": "text", "text": "Results..."}]
   }
7. LLM incorporates tool result into response
8. Stream updated response to client
```

---

## State Management

### Zustand Store Pattern

```typescript
// stores/chat-store.ts
import { create } from 'zustand';

interface ChatState {
  messages: Message[];
  streamingResponse: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  addMessage: (message: Message) => void;
  setStreamingResponse: (response: string) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streamingResponse: '',
  isLoading: false,
  error: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setStreamingResponse: (response) =>
    set({ streamingResponse: response }),

  clearChat: () =>
    set({
      messages: [],
      streamingResponse: '',
      isLoading: false,
      error: null,
    }),
}));
```

### TanStack Query Pattern

```typescript
// In components
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch agents
const { data: agents, isLoading } = useQuery({
  queryKey: ['agents'],
  queryFn: async () => {
    const res = await fetch('/api/agents');
    return res.json();
  },
});

// Create agent
const { mutate: createAgent } = useMutation({
  mutationFn: async (agent: CreateAgentInput) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  },
});
```

### Server State vs Client State

**Server state (PostgreSQL + Redis):**
- User data (profile, preferences)
- Conversations & messages
- Agents, skills, tools
- Billing & subscriptions
- Audit logs

**Client state (Zustand stores):**
- UI state (sidebar open/closed)
- Chat streaming response
- Selected agent/skill
- Form input values
- Search results (temporary)

**Sync pattern:**
1. User opens page
2. TanStack Query fetches from `/api/...` (server)
3. Store data in React Query cache
4. Render components from cache
5. User makes change
6. Mutation to API
7. Optimistic update in Zustand
8. Wait for server response
9. Revalidate cache (query invalidation)

---

## Database Schema & ORM

### Prisma Schema Structure

```prisma
// Core data model
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String?  // hashed
  role      Role     @default(USER)
  
  // Relations
  conversations Conversation[]
  agents        Agent[]
  subscriptions Subscription[]
  tokenLogs     TokenLog[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([email])
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  agentId   String?  // Selected agent for this conversation
  agent     Agent?   @relation(fields: [agentId], references: [id])
  
  messages  Message[]
  artifacts Artifact[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId, createdAt])
  @@index([agentId])
}

model Message {
  id            String   @id @default(cuid())
  conversationId String
  conversation  Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  role      Role     // "user" or "assistant"
  content   String
  
  artifacts Artifact[]
  
  createdAt DateTime @default(now())
  
  @@index([conversationId, createdAt])
}

model Artifact {
  id          String   @id @default(cuid())
  messageId   String?
  message     Message? @relation(fields: [messageId], references: [id], onDelete: SetNull)
  
  type        ArtifactType  // "code" | "document" | "image"
  language    String?       // "javascript", "python", etc
  title       String
  content     String
  
  versions    ArtifactVersion[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Agent {
  id              String   @id @default(cuid())
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  name            String
  description     String
  systemPrompt    String
  model           String   // "kimi-k2.5", "claude-opus", etc
  isBuiltIn       Boolean  @default(false)
  
  // Relations
  tools           AgentTool[]
  skills          AgentSkill[]
  mcpServers      AgentMcpServer[]
  conversations   Conversation[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
}

model AgentTool {
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
  
  toolId  String
  tool    Tool   @relation(fields: [toolId], references: [id], onDelete: Cascade)
  
  enabled Boolean @default(true)
  
  @@id([agentId, toolId])
}

model TokenLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  model     String
  inputTokens     Int
  outputTokens    Int
  costUsd         Float
  
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  planId    String
  plan      SubscriptionPlan @relation(fields: [planId], references: [id])
  
  status    SubscriptionStatus  // "active" | "canceled" | "expired"
  stripeId  String?             // Stripe subscription ID
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
}

model TokenLog {
  // Tracks API token usage for billing
  // Inserted after every chat call
}
```

### Query Patterns

```typescript
// Load conversation with full history
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
  include: {
    messages: {
      take: -10,  // Last 10 messages
      orderBy: { createdAt: 'asc' },
    },
    agent: {
      include: {
        tools: true,
        skills: true,
      },
    },
  },
});

// Save message + artifact
await prisma.message.create({
  data: {
    conversationId,
    role: 'assistant',
    content: aiResponse,
    artifacts: {
      create: [
        {
          type: 'code',
          language: 'typescript',
          title: 'Solution',
          content: codeBlock,
        },
      ],
    },
  },
});

// Log token usage for billing
await prisma.tokenLog.create({
  data: {
    userId,
    model: 'kimi-k2.5',
    inputTokens: 1200,
    outputTokens: 450,
    costUsd: 0.045,
  },
});
```

---

## API Design Patterns

### Standard REST CRUD

```typescript
// GET /api/agents
export async function GET(request: Request) {
  const user = await requireAuth();
  
  const agents = await prisma.agent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  
  return Response.json({ success: true, data: agents });
}

// POST /api/agents
export async function POST(request: Request) {
  const user = await requireAuth();
  const body = CreateAgentSchema.parse(await request.json());
  
  const agent = await prisma.agent.create({
    data: {
      ...body,
      userId: user.id,
    },
  });
  
  return Response.json({ success: true, data: agent }, { status: 201 });
}

// PUT /api/agents/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id } = await params;
  const body = UpdateAgentSchema.parse(await request.json());
  
  const agent = await prisma.agent.update({
    where: { id },
    data: body,
  });
  
  return Response.json({ success: true, data: agent });
}

// DELETE /api/agents/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id } = await params;
  
  await prisma.agent.delete({ where: { id } });
  
  return Response.json({ success: true });
}
```

### Streaming Endpoint

```typescript
// POST /api/chat
export async function POST(request: Request) {
  const user = await requireAuth();
  const body = ChatRequestSchema.parse(await request.json());
  
  // ReadableStream for NDJSON
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Load context
        const agent = await loadAgent(body.agentId);
        const history = await loadConversationHistory(body.conversationId);
        
        // Emit status
        controller.enqueue(
          JSON.stringify({ t: 's', v: 'Searching...' }) + '\n'
        );
        
        // Call MCP tools (if needed)
        const context = await resolveMcpTools(agent.tools);
        
        // Call LLM with streaming
        const response = await callLlm(
          { ...body, context },
          (chunk) => {
            controller.enqueue(
              JSON.stringify({ t: 'c', v: chunk }) + '\n'
            );
          }
        );
        
        // Save to database
        await saveMessage(body.conversationId, response);
        
        // Emit end
        controller.enqueue(JSON.stringify({ t: 'e', v: null }) + '\n');
        controller.close();
      } catch (error) {
        controller.enqueue(
          JSON.stringify({ t: 'e', v: error.message }) + '\n'
        );
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'application/ndjson' },
  });
}
```

### Admin Pattern with Role Check

```typescript
// POST /api/admin/users/[id]/disable
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin role + 2FA
  const admin = await requireAdmin();
  if (!admin.twoFactorEnabled) {
    throw new Error('2FA required for admin access');
  }
  
  const { id } = await params;
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'DISABLE_USER',
      userId: id,
      adminId: admin.id,
      details: {},
    },
  });
  
  // Perform action
  const user = await prisma.user.update({
    where: { id },
    data: { disabled: true },
  });
  
  return Response.json({ success: true, data: user });
}
```

---

## Authentication & Authorization

### NextAuth Configuration

```typescript
// lib/auth.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      async authorize(credentials) {
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });
        
        if (!user) return null;
        
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        
        return isValid ? user : null;
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        role: token.role,
      };
      return session;
    },
  },
  
  jwt: {
    secret: process.env.AUTH_SECRET,
  },
};

export const { handlers, auth } = NextAuth(authOptions);
```

### Protected Route Pattern

```typescript
// lib/auth.ts
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  // Check 2FA
  const adminUser = await db.adminUser.findUnique({
    where: { userId: user.id },
  });
  if (!adminUser?.twoFactorEnabled) {
    throw new Error('2FA required');
  }
  return user;
}

// Usage in API route
export async function POST(request: Request) {
  const user = await requireAuth();  // Throws if not auth
  // ... rest of handler
}
```

---

## Performance Optimization

### Code Splitting

Next.js automatically code-splits at the page level:
```typescript
// pages are auto-split
src/app/(app)/chat/page.tsx        ← 1 bundle
src/app/(app)/agents/page.tsx      ← 1 bundle
src/app/(admin)/admin/users/page.tsx ← 1 bundle
```

### Image Optimization

```typescript
import Image from 'next/image';

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Image
      src={agent.avatarUrl}
      alt={agent.name}
      width={200}
      height={200}
      priority={false}
      loading="lazy"
    />
  );
}
```

Benefits:
- Automatic format negotiation (WebP on supported browsers)
- Lazy loading by default
- Responsive image sizes
- Blur placeholder support

### Database Query Optimization

```typescript
// BAD: N+1 query
const conversations = await prisma.conversation.findMany({
  where: { userId },
});
for (const conv of conversations) {
  const agent = await prisma.agent.findUnique({
    where: { id: conv.agentId },
  });  // Separate query per conversation
}

// GOOD: Single query with relations
const conversations = await prisma.conversation.findMany({
  where: { userId },
  include: { agent: true },  // Single query with JOIN
});

// GOOD: Select only needed fields
const conversations = await prisma.conversation.findMany({
  where: { userId },
  select: {
    id: true,
    createdAt: true,
    agent: { select: { name: true } },
  },
});
```

### Caching Strategy

**Redis cache layers:**
1. **Session cache** — User + permissions (30 min TTL)
2. **Agent metadata** — Agent definition + tools (5 min TTL)
3. **Tool definitions** — Available tools list (10 min TTL)
4. **Exchange rates** — KZT rates (1 hour TTL)

```typescript
// lib/redis.ts
export async function getCachedAgent(agentId: string) {
  const cached = await redis.get(`agent:${agentId}`);
  if (cached) return JSON.parse(cached);
  
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { tools: true, skills: true },
  });
  
  await redis.setex(
    `agent:${agentId}`,
    300,  // 5 min TTL
    JSON.stringify(agent)
  );
  
  return agent;
}
```

---

## Error Handling & Resilience

### Graceful Degradation

```typescript
// Redis unavailable → use in-memory cache
async function getCacheOrNull<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    // Redis error → return null (not critical)
    console.error('Redis unavailable:', error);
    return null;
  }
}

// Usage
const agent = await getCacheOrNull('agent:123') || 
  await db.agent.findUnique({ where: { id: '123' } });
```

### Circuit Breaker Pattern

```typescript
// For Orchestrator calls
const circuitBreaker = new CircuitBreaker({
  async callFn() {
    return await fetch(`${ORCHESTRATOR_URL}/mcp/legal_kz`, ...);
  },
  failureThreshold: 5,
  timeout: 30000,
});

try {
  const result = await circuitBreaker.call();
} catch (error) {
  if (error.code === 'CIRCUIT_BREAKER_OPEN') {
    // Use cached results or fallback
    return getCachedToolResults();
  }
}
```

### Error Boundaries

```typescript
// components/ErrorBoundary.tsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// components/__tests__/ChatInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('should submit message on Enter', () => {
    const handleSubmit = vi.fn();
    render(<ChatInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(handleSubmit).toHaveBeenCalledWith('Hello');
  });
});
```

### Integration Tests

```typescript
// tests/chat.integration.test.ts
import { db } from '@/lib/db';
import { POST as chatHandler } from '@/app/api/chat/route';

describe('Chat API', () => {
  it('should stream NDJSON response', async () => {
    const user = await createTestUser();
    const conversation = await db.conversation.create({
      data: { userId: user.id },
    });
    
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: conversation.id,
        message: 'Hello',
      }),
    });
    
    const response = await chatHandler(request);
    expect(response.headers.get('content-type')).toBe('application/ndjson');
    
    const reader = response.body.getReader();
    const { value } = await reader.read();
    const line = new TextDecoder().decode(value);
    const event = JSON.parse(line);
    expect(event.t).toEqual('c');  // content event
  });
});
```

---

## Design Decisions

### Why Zustand instead of Redux?

- **Simpler API** — No actions, reducers, selectors (just functions)
- **Less boilerplate** — 10 lines instead of 50 for a store
- **Smaller bundle** — 2KB vs 60KB
- **TypeScript first** — Natural type inference

### Why TanStack Query instead of custom fetching?

- **Built-in caching** — Automatic deduplication
- **Background sync** — Automatic refetching on focus
- **Optimistic updates** — Show changes before server confirms
- **DevTools** — Browser extension for debugging

### Why NDJSON instead of Server-Sent Events?

- **No framing** — Each line is valid JSON (partial sends work)
- **Works with proxies** — Some proxies interfere with SSE
- **Simpler parsing** — Line-by-line instead of event parsing
- **Better for tests** — Easier to mock response chunks

### Why Prisma ORM?

- **Type safety** — Schema-driven typing
- **Migrations** — Version control + atomic changes
- **Query optimization** — Automatic select vs include
- **Multi-DB support** — PostgreSQL, MySQL, SQLite

---

## References

| Document | Audience | Content |
|----------|----------|---------|
| **README.md** | All devs | Quick start, project structure |
| **CLAUDE.md** | Developers | API routes, patterns, troubleshooting |
| **ARCHITECTURE.md** | Architects | Component design, data flows |
| **../CLAUDE.md** | DevOps | Deployment, infrastructure |
| **../ARCHITECTURE.md** | Full team | System integration, scaling |

---

<p align="center">
  <b>Clean architecture. Type-safe. Streaming-first. Always online.</b><br/>
  <i>Every component designed for reliability and performance.</i>
</p>
