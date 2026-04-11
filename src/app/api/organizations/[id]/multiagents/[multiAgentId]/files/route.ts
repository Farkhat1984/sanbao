import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { MAX_AGENT_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { parseFileToText } from "@/lib/parse-file";

type RouteParams = { params: Promise<{ id: string; multiAgentId: string }> };

async function verifyAccess(orgId: string, multiAgentId: string, userId: string, requireWrite = false) {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership) return { error: jsonError("Нет доступа", 403) };
  if (requireWrite && membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: jsonError("Нет прав", 403) };
  }

  const multiAgent = await prisma.multiAgent.findUnique({
    where: { id: multiAgentId },
  });
  if (!multiAgent || multiAgent.orgId !== orgId) {
    return { error: jsonError("Мультиагент не найден", 404) };
  }

  return { membership, multiAgent };
}

export async function POST(req: Request, { params }: RouteParams) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const access = await verifyAccess(orgId, multiAgentId, userId, true);
  if ("error" in access) return access.error;

  // Business plan check: org owner must have canUseRag
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (!org) return jsonError("Организация не найдена", 404);

  const sub = await prisma.subscription.findUnique({
    where: { userId: org.ownerId },
    include: { plan: { select: { maxStorageMb: true, canUseRag: true } } },
  });
  if (!sub?.plan?.canUseRag) {
    return jsonError("Файлы знаний доступны только на тарифе Business", 403);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return jsonError("Файл не найден", 400);
  }

  if (file.size > MAX_AGENT_FILE_SIZE) {
    return jsonError("Файл слишком большой (макс. 100MB)", 400);
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return jsonError("Неподдерживаемый тип файла", 400);
  }

  // Storage quota check (aggregate across all org multi-agent files)
  const maxStorageMb = sub.plan.maxStorageMb || 0;
  if (maxStorageMb > 0) {
    const usedBytes = await prisma.multiAgentFile.aggregate({
      where: { multiAgent: { orgId } },
      _sum: { fileSize: true },
    });
    const usedMb = (usedBytes._sum.fileSize || 0) / (1024 * 1024);
    const fileMb = file.size / (1024 * 1024);
    if (usedMb + fileMb > maxStorageMb) {
      return jsonError(
        `Превышена квота хранилища (${maxStorageMb} МБ). Используется: ${usedMb.toFixed(1)} МБ`,
        413,
      );
    }
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "org",
    orgId,
    "multiagents",
    multiAgentId,
  );
  await mkdir(uploadDir, { recursive: true });

  // Sanitize filename
  const safeName = file.name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^\w.\-() ]/g, "_")
    .slice(0, 200);
  const uniqueName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, uniqueName);

  // Verify resolved path stays within upload directory
  if (!filePath.startsWith(uploadDir)) {
    return jsonError("Недопустимое имя файла", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const fileUrl = `/uploads/org/${orgId}/multiagents/${multiAgentId}/${uniqueName}`;

  // Extract text from all supported file types
  let extractedText: string | null = null;
  if (!file.type.startsWith("image/")) {
    try {
      const result = await parseFileToText(buffer, file.name, file.type);
      // Strip null bytes -- PostgreSQL rejects 0x00 in text columns
      extractedText = result.text ? result.text.replace(/\0/g, "") : null;
    } catch {
      // Non-critical: file will be saved but without extracted text
    }
  }

  // Large files default to lazy mode to prevent context overflow
  const inContext = file.size <= 100_000;

  const multiAgentFile = await prisma.multiAgentFile.create({
    data: {
      multiAgentId,
      fileName: file.name,
      fileType: file.type,
      fileUrl,
      fileSize: file.size,
      extractedText,
      inContext,
      storageKey: `org/${orgId}/multiagents/${multiAgentId}/${uniqueName}`,
    },
  });

  return jsonOk({
    ...multiAgentFile,
    createdAt: multiAgentFile.createdAt.toISOString(),
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const access = await verifyAccess(orgId, multiAgentId, userId, true);
  if ("error" in access) return access.error;

  const { fileId, inContext } = await req.json();

  const file = await prisma.multiAgentFile.findFirst({
    where: { id: fileId, multiAgentId },
  });
  if (!file) return jsonError("Файл не найден", 404);

  const updated = await prisma.multiAgentFile.update({
    where: { id: fileId },
    data: { inContext: inContext ?? true },
  });

  return jsonOk({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, multiAgentId } = await params;

  const access = await verifyAccess(orgId, multiAgentId, userId, true);
  if ("error" in access) return access.error;

  const { fileId } = await req.json();

  const file = await prisma.multiAgentFile.findFirst({
    where: { id: fileId, multiAgentId },
  });
  if (!file) return jsonError("Файл не найден", 404);

  // Delete from filesystem
  try {
    const publicDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(process.cwd(), "public", file.fileUrl);
    if (filePath.startsWith(publicDir)) {
      await unlink(filePath);
    }
  } catch {
    // File may not exist on disk
  }

  await prisma.multiAgentFile.delete({ where: { id: fileId } });

  return jsonOk({ success: true });
}
