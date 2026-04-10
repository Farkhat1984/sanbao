import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { MAX_AGENT_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { parseFileToText } from "@/lib/parse-file";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!agent) {
    return jsonError("Агент не найден", 404);
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

  // Storage quota check
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    include: { plan: { select: { maxStorageMb: true } } },
  });
  const maxStorageMb = sub?.plan?.maxStorageMb || 0;
  if (maxStorageMb > 0) {
    const usedBytes = await prisma.agentFile.aggregate({
      where: { agent: { userId: session.user.id } },
      _sum: { fileSize: true },
    });
    const usedMb = (usedBytes._sum.fileSize || 0) / (1024 * 1024);
    const fileMb = file.size / (1024 * 1024);
    if (usedMb + fileMb > maxStorageMb) {
      return jsonError(`Превышена квота хранилища (${maxStorageMb} МБ). Используется: ${usedMb.toFixed(1)} МБ`, 413);
    }
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "agents",
    id
  );
  await mkdir(uploadDir, { recursive: true });

  // Sanitize filename: strip path separators and dangerous sequences
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

  const fileUrl = `/uploads/agents/${id}/${uniqueName}`;

  // Extract text from all supported file types
  let extractedText: string | null = null;
  if (!file.type.startsWith("image/")) {
    try {
      const raw = await parseFileToText(buffer, file.name, file.type);
      // Strip null bytes — PostgreSQL rejects 0x00 in text columns
      extractedText = raw ? raw.replace(/\0/g, "") : null;
    } catch {
      // Non-critical: file will be saved but without extracted text
    }
  }

  // All permanent memory files are always in context — the context budget
  // in tool-resolver.ts handles overflow by truncating, not hiding
  const inContext = true;

  const agentFile = await prisma.agentFile.create({
    data: {
      agentId: id,
      fileName: file.name,
      fileType: file.type,
      fileUrl,
      fileSize: file.size,
      extractedText,
      inContext,
    },
  });

  return jsonOk({
    ...agentFile,
    createdAt: agentFile.createdAt.toISOString(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;
  const { fileId, inContext } = await req.json();

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!agent) {
    return jsonError("Агент не найден", 404);
  }

  const file = await prisma.agentFile.findFirst({
    where: { id: fileId, agentId: id },
  });

  if (!file) {
    return jsonError("Файл не найден", 404);
  }

  const updated = await prisma.agentFile.update({
    where: { id: fileId },
    data: { inContext: inContext ?? true },
  });

  return jsonOk({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;
  const { fileId } = await req.json();

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!agent) {
    return jsonError("Агент не найден", 404);
  }

  const file = await prisma.agentFile.findFirst({
    where: { id: fileId, agentId: id },
  });

  if (!file) {
    return jsonError("Файл не найден", 404);
  }

  // Delete from filesystem — verify path stays within public/uploads
  try {
    const publicDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(process.cwd(), "public", file.fileUrl);
    if (filePath.startsWith(publicDir)) {
      await unlink(filePath);
    }
  } catch {
    // File may not exist on disk
  }

  await prisma.agentFile.delete({ where: { id: fileId } });

  return jsonOk({ success: true });
}
