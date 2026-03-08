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
  model: z.string().max(100).optional().default("default"),
  icon: z.string().max(50).optional(),
  iconColor: z.string().max(20).optional(),
  avatar: z.string().max(500).optional().nullable(),
  starterPrompts: z.array(z.string().max(500)).max(10).optional().default([]),
  skillIds: z.array(z.string()).max(50).optional().default([]),
  mcpServerIds: z.array(z.string()).max(50).optional().default([]),
  integrationIds: z.array(z.string()).max(20).optional().default([]),
});

export const agentUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).nullable().transform((s) => s?.trim() || null),
  instructions: z.string().min(1).max(50000).transform((s) => s.trim()),
  model: z.string().max(100),
  icon: z.string().max(50),
  iconColor: z.string().max(20),
  avatar: z.string().max(500).nullable(),
  starterPrompts: z.array(z.string().max(500)).max(10),
  skillIds: z.array(z.string()).max(50),
  mcpServerIds: z.array(z.string()).max(50),
  toolIds: z.array(z.string()).max(50),
  integrationIds: z.array(z.string()).max(20),
}).partial();

// ─── Tool ────────────────────────────────────────────────

export const toolCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).optional().nullable().transform((s) => s?.trim() || null),
  icon: z.string().max(50).optional().default("Wrench"),
  iconColor: z.string().max(20).optional().default("#8FAF9F"),
  type: z.enum(["PROMPT_TEMPLATE", "WEBHOOK", "URL", "FUNCTION"]).optional().default("PROMPT_TEMPLATE"),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  inputSchema: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const toolUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).nullable().transform((s) => s?.trim() || null),
  icon: z.string().max(50),
  iconColor: z.string().max(20),
  type: z.enum(["PROMPT_TEMPLATE", "WEBHOOK", "URL", "FUNCTION"]),
  config: z.record(z.string(), z.unknown()),
  inputSchema: z.record(z.string(), z.unknown()).nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
}).partial();

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
  category: z.enum(["LEGAL", "BUSINESS", "CODE", "CONTENT", "ANALYSIS", "PRODUCTIVITY", "CUSTOM"]).optional().default("CUSTOM"),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});

export const skillUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).nullable().transform((s) => s?.trim() || null),
  systemPrompt: z.string().min(1).max(50000).transform((s) => s.trim()),
  templates: z.unknown().nullable(),
  citationRules: z.string().max(5000).nullable().transform((s) => s?.trim() || null),
  jurisdiction: z.string().max(10),
  icon: z.string().max(50),
  iconColor: z.string().max(20),
  isPublic: z.boolean(),
  category: z.enum(["LEGAL", "BUSINESS", "CODE", "CONTENT", "ANALYSIS", "PRODUCTIVITY", "CUSTOM"]),
  tags: z.array(z.string().max(50)).max(20),
}).partial();

// ─── Organization ───────────────────────────────────────

export const orgCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  avatar: z.string().max(2000).optional().nullable(),
});

export const orgUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  avatar: z.string().max(2000).nullable(),
}).partial();

export const orgInviteSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const orgAgentCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).optional().nullable().transform((s) => s?.trim() || null),
  icon: z.string().max(50).optional().nullable(),
  iconColor: z.string().max(20).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable().transform((s) => s?.trim() || null),
  starterPrompts: z.array(z.string().max(200)).max(6).optional(),
  skillIds: z.array(z.string()).max(20).optional(),
  mcpServerIds: z.array(z.string()).max(10).optional(),
});

// ─── Integration ────────────────────────────────────────

export const integrationCreateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  type: z.enum(["ODATA_1C"]),
  baseUrl: z.string().url().max(500),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

export const integrationUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  baseUrl: z.string().url().max(500),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
}).partial();

// ─── Conversation update (whitelist fields) ──────────────

export const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  agentId: z.string().optional().nullable(),
}).strict();
