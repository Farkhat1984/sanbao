/**
 * Agent repository — centralizes agent-related DB queries.
 * Replaces scattered prisma.agent calls across routes.
 */

import { prisma } from "@/lib/prisma";

const AGENT_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  icon: true,
  iconColor: true,
  avatar: true,
  status: true,
  isSystem: true,
  sortOrder: true,
  createdAt: true,
  _count: { select: { conversations: true } },
} as const;

const AGENT_DETAIL_INCLUDE = {
  skills: { include: { skill: { select: { id: true, name: true, icon: true } } } },
  mcpServers: { include: { mcpServer: { select: { id: true, name: true, url: true } } } },
  tools: { include: { tool: { select: { id: true, name: true, icon: true } } } },
} as const;

export async function findSystemAgents() {
  return prisma.agent.findMany({
    where: { isSystem: true, status: "APPROVED" },
    select: AGENT_LIST_SELECT,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function findUserAgents(userId: string) {
  return prisma.agent.findMany({
    where: { userId, isSystem: false },
    select: AGENT_LIST_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

export async function findAgentById(id: string) {
  return prisma.agent.findUnique({
    where: { id },
    include: AGENT_DETAIL_INCLUDE,
  });
}

export async function countUserAgents(userId: string) {
  return prisma.agent.count({
    where: { userId, isSystem: false },
  });
}
