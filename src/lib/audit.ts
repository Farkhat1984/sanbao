import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(opts: {
  actorId: string;
  action: string;
  target: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: opts.actorId,
      action: opts.action,
      target: opts.target,
      targetId: opts.targetId || null,
      details: opts.details ? (opts.details as Prisma.InputJsonValue) : undefined,
      ip: opts.ip || null,
    },
  });
}

export async function logError(opts: {
  route: string;
  method: string;
  message: string;
  stack?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.errorLog.create({
    data: {
      route: opts.route,
      method: opts.method,
      message: opts.message,
      stack: opts.stack || null,
      userId: opts.userId || null,
      metadata: opts.metadata ? (opts.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function logTokenUsage(opts: {
  userId: string;
  conversationId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}) {
  const cost =
    ((opts.inputTokens / 1000) * (opts.costPer1kInput || 0)) +
    ((opts.outputTokens / 1000) * (opts.costPer1kOutput || 0));

  await prisma.tokenLog.create({
    data: {
      userId: opts.userId,
      conversationId: opts.conversationId || null,
      provider: opts.provider,
      model: opts.model,
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      cost,
    },
  });
}
