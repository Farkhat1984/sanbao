import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { MAX_AGENT_FILE_SIZE } from "@/lib/constants";
import {
  createNamespace,
  createProject,
  uploadFile as uploadToCortex,
} from "@/lib/ai-cortex-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id, userId },
  });
  if (!agent) return jsonError("Агент не найден", 404);

  // Check subscription: canUseRag required
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: { select: { canUseRag: true } } },
  });
  if (!sub?.plan?.canUseRag) {
    return jsonError("Для базы знаний требуется тариф Business", 403);
  }

  // Load user for cortex namespace
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, cortexNamespace: true, cortexNsApiKey: true, name: true, email: true },
  });
  if (!user) return jsonError("Пользователь не найден", 404);

  // Lazy-create cortex namespace
  if (!user.cortexNamespace) {
    const slug = `user_${userId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const displayName = user.name || user.email;
    try {
      const ns = await createNamespace(slug, displayName);
      const encryptedKey = encrypt(ns.apiKey);
      await prisma.user.update({
        where: { id: userId },
        data: { cortexNamespace: slug, cortexNsApiKey: encryptedKey },
      });
      user = { ...user, cortexNamespace: slug, cortexNsApiKey: encryptedKey };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания namespace";
      return jsonError(msg, 502);
    }
  }

  if (!user.cortexNsApiKey) return jsonError("API ключ namespace не найден", 500);
  const nsApiKey = decrypt(user.cortexNsApiKey);

  // Lazy-create project
  let projectId = agent.projectId;
  if (!projectId) {
    const agentSlug = `agent_${id}`;
    try {
      const project = await createProject(nsApiKey, agentSlug, agent.name);
      projectId = project.id;
      await prisma.agent.update({
        where: { id },
        data: { projectId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания проекта";
      return jsonError(msg, 502);
    }
  }

  // Parse form data
  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError("Неверные данные формы", 400);

  let files = formData.getAll("files") as File[];
  if (files.length === 0) {
    const single = formData.get("file") as File | null;
    if (single) files = [single];
  }
  if (files.length === 0) return jsonError("Файлы не найдены", 400);

  const uploaded: Array<{ id: string; fileName: string; fileSize: number; tier: string }> = [];

  for (const file of files) {
    if (file.size > MAX_AGENT_FILE_SIZE) {
      return jsonError(`"${file.name}" превышает лимит 100 МБ`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to AI Cortex
    try {
      await uploadToCortex(nsApiKey, projectId!, buffer, file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка загрузки в AI Cortex";
      return jsonError(`${file.name}: ${msg}`, 502);
    }

    // Create AgentFile record with tier "fdb" (no local extractedText needed)
    const record = await prisma.agentFile.create({
      data: {
        agentId: id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: `cortex://${projectId}/${file.name}`,
        tier: "fdb",
        inContext: false,
      },
    });

    uploaded.push({ id: record.id, fileName: record.fileName, fileSize: record.fileSize, tier: "fdb" });
  }

  return jsonOk(uploaded.map(serializeDates), 201);
}
