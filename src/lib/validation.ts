import { z } from "zod";

// ─── Pagination ──────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  return paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
}

// ─── Agent ───────────────────────────────────────────────

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).optional().nullable().transform((s) => s?.trim() || null),
  instructions: z.string().min(1).max(50000).transform((s) => s.trim()),
  model: z.string().max(100).optional().default("openai"),
  icon: z.string().max(50).optional(),
  iconColor: z.string().max(20).optional(),
  avatar: z.string().max(500).optional().nullable(),
  starterPrompts: z.array(z.string().max(500)).max(10).optional().default([]),
  skillIds: z.array(z.string()).max(50).optional().default([]),
  mcpServerIds: z.array(z.string()).max(50).optional().default([]),
});

// ─── Tool ────────────────────────────────────────────────

export const toolCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).optional().nullable().transform((s) => s?.trim() || null),
  icon: z.string().max(50).optional().default("Wrench"),
  iconColor: z.string().max(20).optional().default("#4F6EF7"),
  type: z.enum(["PROMPT_TEMPLATE", "WEBHOOK", "URL", "FUNCTION"]).optional().default("PROMPT_TEMPLATE"),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  inputSchema: z.record(z.string(), z.unknown()).optional().nullable(),
});

// ─── Skill ───────────────────────────────────────────────

export const skillCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).optional().nullable().transform((s) => s?.trim() || null),
  systemPrompt: z.string().min(1).max(50000).transform((s) => s.trim()),
  templates: z.unknown().optional().nullable(),
  citationRules: z.string().max(5000).optional().nullable().transform((s) => s?.trim() || null),
  jurisdiction: z.string().max(10).optional().default("RU"),
  icon: z.string().max(50).optional(),
  iconColor: z.string().max(20).optional(),
});

// ─── Conversation update (whitelist fields) ──────────────

export const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  agentId: z.string().optional().nullable(),
}).strict();
