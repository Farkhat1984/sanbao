import { PrismaClient } from "@prisma/client";
import { readReplicas } from "@prisma/extension-read-replicas";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const logConfig =
    process.env.NODE_ENV === "development"
      ? [
          { emit: "stdout" as const, level: "warn" as const },
          { emit: "stdout" as const, level: "error" as const },
        ]
      : [{ emit: "stdout" as const, level: "error" as const }];

  const client = new PrismaClient({ log: logConfig });

  // If a read replica URL is configured, route read queries there
  const replicaUrl = process.env.DATABASE_REPLICA_URL;
  if (replicaUrl) {
    const replica = new PrismaClient({
      log: logConfig,
      datasourceUrl: replicaUrl,
    });

    return client.$extends(
      readReplicas({ replicas: [replica] })
    ) as unknown as PrismaClient;
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
