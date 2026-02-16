import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage";
import { readdir, stat, unlink } from "fs/promises";
import path from "path";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  // Attachments stats (bounded to prevent OOM on large datasets)
  const attachments = await prisma.attachment.findMany({
    take: 5000,
    include: {
      conversation: {
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Agent files stats
  const agentFiles = await prisma.agentFile.findMany({
    take: 5000,
    include: {
      agent: {
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Combine all files
  const allFiles = [
    ...attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      userId: a.conversation.userId,
      userName: a.conversation.user.name || a.conversation.user.email,
      createdAt: a.createdAt,
    })),
    ...agentFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
      userId: f.agent.userId || "system",
      userName: f.agent.user?.name || f.agent.user?.email || "Системный",
      createdAt: f.createdAt,
    })),
  ];

  const totalFiles = allFiles.length;
  const totalSize = allFiles.reduce((s, f) => s + f.fileSize, 0);

  // Group by user
  const userMap: Record<string, { userName: string; fileCount: number; totalSize: number }> = {};
  for (const f of allFiles) {
    if (!userMap[f.userId]) {
      userMap[f.userId] = { userName: f.userName, fileCount: 0, totalSize: 0 };
    }
    userMap[f.userId].fileCount++;
    userMap[f.userId].totalSize += f.fileSize;
  }

  const byUser = Object.entries(userMap)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 20);

  // Recent files
  const recentFiles = allFiles
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30)
    .map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    }));

  return NextResponse.json({
    totalFiles,
    totalSize,
    byUser,
    recentFiles,
    storageConfigured: isStorageConfigured(),
  });
}

/** POST — cleanup orphaned files from disk */
export async function POST() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "agents");
  let deletedFiles = 0;
  let freedBytes = 0;

  // Get all known file URLs from DB
  const dbFiles = await prisma.agentFile.findMany({ select: { fileUrl: true } });
  const knownUrls = new Set(dbFiles.map((f) => f.fileUrl));

  // Scan disk for orphaned files
  try {
    const agentDirs = await readdir(uploadsDir);
    for (const agentDir of agentDirs) {
      const dirPath = path.join(uploadsDir, agentDir);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) continue;

      const files = await readdir(dirPath);
      for (const file of files) {
        const expectedUrl = `/uploads/agents/${agentDir}/${file}`;
        if (!knownUrls.has(expectedUrl)) {
          const filePath = path.join(dirPath, file);
          const fileStat = await stat(filePath);
          await unlink(filePath);
          deletedFiles++;
          freedBytes += fileStat.size;
        }
      }

      // Remove empty directories
      const remaining = await readdir(dirPath);
      if (remaining.length === 0) {
        const { rmdir } = await import("fs/promises");
        await rmdir(dirPath);
      }
    }
  } catch {
    // uploads dir may not exist
  }

  // Remove DB records for agents that no longer exist
  const orphanedDbFiles = await prisma.agentFile.findMany({
    where: { agent: { is: undefined as unknown as undefined } },
    select: { id: true, fileSize: true },
  });

  // Alternative: find agentFiles whose agentId doesn't match any agent
  const allAgentIds = (await prisma.agent.findMany({ select: { id: true } })).map((a) => a.id);
  const orphanedRecords = await prisma.agentFile.findMany({
    where: { agentId: { notIn: allAgentIds.length > 0 ? allAgentIds : ["_none_"] } },
  });

  // Delete orphaned files from disk
  for (const rec of orphanedRecords) {
    try {
      const filePath = path.join(process.cwd(), "public", rec.fileUrl);
      await unlink(filePath);
    } catch { /* already gone */ }
    freedBytes += rec.fileSize;
  }

  // Batch delete all orphaned DB records
  const orphanedIds = orphanedRecords.map((r) => r.id);
  const deletedRecords = orphanedIds.length > 0
    ? (await prisma.agentFile.deleteMany({ where: { id: { in: orphanedIds } } })).count
    : 0;

  return NextResponse.json({
    deletedFiles,
    deletedRecords,
    freedBytes,
    freedMb: +(freedBytes / (1024 * 1024)).toFixed(2),
  });
}

/** DELETE — delete a specific file by id and type */
export async function DELETE(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { fileId, type } = await req.json();
  if (!fileId || !type) {
    return NextResponse.json({ error: "fileId and type required" }, { status: 400 });
  }

  if (type === "agent") {
    const file = await prisma.agentFile.findUnique({ where: { id: fileId } });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
      await unlink(path.join(process.cwd(), "public", file.fileUrl));
    } catch { /* file may not exist */ }
    await prisma.agentFile.delete({ where: { id: fileId } });
  }

  return NextResponse.json({ success: true });
}
