/**
 * User repository — centralizes user-related DB queries.
 */

import { prisma } from "@/lib/prisma";

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isBanned: true,
      createdAt: true,
    },
  });
}

export async function findUserWithPlan(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });
}

export async function getUserPlan(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });
  return user?.subscription?.plan ?? null;
}
