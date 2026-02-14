import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { parseFileToText } from "@/lib/parse-file";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 10MB)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Неподдерживаемый тип файла" },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: `Превышена квота хранилища (${maxStorageMb} МБ). Используется: ${usedMb.toFixed(1)} МБ` },
        { status: 413 }
      );
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

  const uniqueName = `${Date.now()}-${file.name}`;
  const filePath = path.join(uploadDir, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const fileUrl = `/uploads/agents/${id}/${uniqueName}`;

  // Extract text from all supported file types
  let extractedText: string | null = null;
  if (!file.type.startsWith("image/")) {
    try {
      extractedText = await parseFileToText(buffer, file.name, file.type);
    } catch {
      // Non-critical: file will be saved but without extracted text
    }
  }

  const agentFile = await prisma.agentFile.create({
    data: {
      agentId: id,
      fileName: file.name,
      fileType: file.type,
      fileUrl,
      fileSize: file.size,
      extractedText,
    },
  });

  return NextResponse.json({
    ...agentFile,
    createdAt: agentFile.createdAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { fileId } = await req.json();

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Агент не найден" }, { status: 404 });
  }

  const file = await prisma.agentFile.findFirst({
    where: { id: fileId, agentId: id },
  });

  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  // Delete from filesystem
  try {
    const filePath = path.join(process.cwd(), "public", file.fileUrl);
    await unlink(filePath);
  } catch {
    // File may not exist on disk
  }

  await prisma.agentFile.delete({ where: { id: fileId } });

  return NextResponse.json({ success: true });
}
