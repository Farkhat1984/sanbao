# LeemaDB Knowledge Base — Implementation

## Problems Fixed

1. **3 separate clicks** → now 1 click: "Загрузить и обработать"
2. **No progress bar** → button transforms into progress bar with stages + %
3. **No cancel/delete** → cancel during processing + delete published knowledge
4. **Manual publish** → auto-publish after processing completes (SSE → publish → MCP created)
5. **No auto-chain** → upload → process → SSE → auto-publish → done

## User Flow (implemented)

```
1. User drags files → files appear in staged list
2. User clicks "Загрузить и обработать" (single button)
3. Button transforms into progress bar with stages + cancel button
4. Pipeline runs: upload → process → (SSE progress 0-90%) → auto-publish (90-100%)
5. On completion: MCP server auto-created, linked to agent
6. User sees "База знаний активна" with tool count + add/delete buttons
```

## State Machine

```
NONE → [click "Загрузить и обработать"] → PROCESSING → (auto-publish) → PUBLISHED
                                               ↓                            ↓
                                          [Остановить]               [Удалить]
                                               ↓                            ↓
                                             NONE                        NONE

Any error → ERROR → [Повторить] → NONE
```

## Files Modified/Created

| File | Action | Status |
|------|--------|--------|
| `src/lib/ai-cortex-client.ts` | Added `getProject()` and `cancelJob()` | DONE |
| `src/app/api/agents/[id]/knowledge/cancel/route.ts` | NEW: cancel processing job | DONE |
| `src/app/api/agents/[id]/knowledge/delete/route.ts` | NEW: delete entire knowledge base | DONE |
| `packages/ui/src/components/agents/AgentKnowledgeSection.tsx` | REWRITTEN: unified 1-click flow | DONE |
| `src/app/api/agents/[id]/route.ts` | Added `discoveredTools` to MCP select | DONE |
| `src/types/agent.ts` | Added `discoveredTools` to Agent type | DONE |
| `src/app/(app)/agents/[id]/page.tsx` | Pass `toolCount` prop | DONE |

## Key Architecture Decisions

1. **Frontend-driven chain**: Upload + Process happen sequentially in `handleUploadAndProcess()`. After process starts, SSE monitors progress. When SSE reports "completed", frontend auto-calls publish endpoint.

2. **Progress scaling**: Orchestrator progress (0-100%) scaled to 0-90% on frontend. Last 10% reserved for publish step (creating MCP server + tool discovery).

3. **Cancel**: Gets project from Cortex to find `current_job_id`, then calls `POST /api/jobs/{jobId}/cancel`. Best-effort — if job already finished, it resets status to NONE.

4. **Delete**: Cascading cleanup — deletes Cortex project, MCP server, AgentMcpServer links, AgentFile records (tier="fdb"), resets agent.projectId and knowledgeStatus.

## MCP Auto-Creation Details

After publish returns `{ endpoint, domain }`:
- MCP Server name: `"{agent.name} - LeemaDB"`
- MCP Server URL: `http://orchestrator:8120/mcp/{domain}` (Docker internal)
- Transport: STREAMABLE_HTTP
- API Key: user's cortexNsApiKey (encrypted)
- Auto-discover tools via connectAndDiscoverTools
- Auto-link via AgentMcpServer junction

## Existing Endpoints (unchanged)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agents/[id]/knowledge/upload` | Upload files to Cortex |
| `POST /api/agents/[id]/knowledge/process` | Start pipeline processing |
| `GET /api/agents/[id]/knowledge/progress` | SSE progress stream |
| `PATCH /api/agents/[id]/knowledge/status` | Persist status to DB |
| `POST /api/agents/[id]/knowledge/publish` | Publish as MCP server |
| `POST /api/agents/[id]/knowledge/cancel` | **NEW** Cancel processing |
| `POST /api/agents/[id]/knowledge/delete` | **NEW** Delete entire knowledge base |

## E2E Test Checklist

- [ ] Upload PDF → progress bar shows → MCP auto-created → agent has tools
- [ ] Cancel during processing → status resets to NONE
- [ ] Delete published knowledge → MCP removed, files cleared, status NONE
- [ ] Error during processing → error banner → retry works
- [ ] Add more files after published → upload+process+republish works
