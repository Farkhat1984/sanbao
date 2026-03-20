/**
 * Conversation repository — centralizes conversation-related DB queries.
 * Replaces scattered prisma.conversation/conversationSummary/task calls.
 */

import { prisma } from "@/lib/prisma";

export async function getConversationContext(conversationId: string, userId: string, userFilesLimit: number) {
  const [contextData, userMemories, activeTasks, userFiles] = await Promise.all([
    Promise.all([
      prisma.conversationSummary.findUnique({ where: { conversationId } }),
      prisma.conversationPlan.findFirst({
        where: { conversationId, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    ]),
    prisma.userMemory.findMany({
      where: { userId },
      select: { key: true, content: true },
    }),
    prisma.task.findMany({
      where: { conversationId, status: "IN_PROGRESS" },
      select: { title: true, steps: true, progress: true },
    }),
    prisma.userFile.findMany({
      where: { userId },
      select: { name: true, description: true, fileType: true },
      orderBy: { updatedAt: "desc" },
      take: userFilesLimit,
    }),
  ]);

  const [summary, activePlan] = contextData;

  return {
    existingSummary: summary?.content ?? null,
    planMemory: (activePlan as { memory: string | null } | null)?.memory ?? null,
    userMemories,
    activeTasks: activeTasks as Array<{
      title: string;
      steps: Array<{ text: string; done: boolean }>;
      progress: number;
    }>,
    userFiles,
  };
}

export async function getConversationContextWithoutConversation(userId: string, userFilesLimit: number) {
  const [userMemories, userFiles] = await Promise.all([
    prisma.userMemory.findMany({
      where: { userId },
      select: { key: true, content: true },
    }),
    prisma.userFile.findMany({
      where: { userId },
      select: { name: true, description: true, fileType: true },
      orderBy: { updatedAt: "desc" },
      take: userFilesLimit,
    }),
  ]);

  return {
    existingSummary: null,
    planMemory: null,
    userMemories,
    activeTasks: [] as Array<{ title: string; steps: Array<{ text: string; done: boolean }>; progress: number }>,
    userFiles,
  };
}
