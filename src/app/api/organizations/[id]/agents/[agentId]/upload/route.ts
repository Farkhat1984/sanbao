import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { checkOrgLimit, checkOrgFileSize } from "@/lib/org-limits";
import { decrypt } from "@/lib/crypto";
import { uploadFile as uploadToS3 } from "@/lib/storage";
import { uploadFile as uploadToCortex } from "@/lib/ai-cortex-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;
  const { id, agentId } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId: id },
  });
  if (!agent) return jsonError("Агент не найден", 404);
  if (!agent.projectId) return jsonError("Проект не создан", 400);

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org?.nsApiKey) return jsonError("Namespace не настроен", 400);

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError("Неверные данные формы", 400);

  // Accept both "files" (multiple) and "file" (single) field names
  let files = formData.getAll("files") as File[];
  if (files.length === 0) {
    const single = formData.get("file") as File | null;
    if (single) files = [single];
  }
  if (files.length === 0) return jsonError("Файлы не найдены", 400);

  // Check limits per file
  if (session.user.role !== "ADMIN") {
    const fileLimit = await checkOrgLimit(org.ownerId, "files", agentId);
    if (!fileLimit.allowed) return jsonError(fileLimit.error!, 403);
  }

  const nsApiKey = decrypt(org.nsApiKey);
  const uploaded: Array<{ id: string; fileName: string; fileSize: number }> = [];

  for (const file of files) {
    if (session.user.role !== "ADMIN") {
      const sizeCheck = await checkOrgFileSize(org.ownerId, file.size);
      if (!sizeCheck.allowed) return jsonError(`${file.name}: ${sizeCheck.error}`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const storageKey = `org/${id}/agents/${agentId}/${Date.now()}-${file.name}`;
    let fileUrl = storageKey;
    try {
      await uploadToS3(storageKey, buffer, file.type);
    } catch {
      // S3 not configured — store URL as key
    }

    // Upload to AI Cortex
    try {
      await uploadToCortex(nsApiKey, agent.projectId, buffer, file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка загрузки в AI Cortex";
      return jsonError(`${file.name}: ${msg}`, 502);
    }

    const record = await prisma.orgAgentFile.create({
      data: {
        orgAgentId: agentId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl,
        storageKey,
      },
    });

    uploaded.push({ id: record.id, fileName: record.fileName, fileSize: record.fileSize });
  }

  return jsonOk(uploaded.map(serializeDates), 201);
}
