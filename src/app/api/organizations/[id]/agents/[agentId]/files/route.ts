import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { checkOrgLimit, checkOrgFileSize } from "@/lib/org-limits";
import { MAX_AGENT_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { encrypt, decrypt } from "@/lib/crypto";
import { uploadFile as uploadToS3 } from "@/lib/storage";
import {
  createNamespace,
  createProject,
  uploadFile as uploadToCortex,
} from "@/lib/ai-cortex-client";

type RouteParams = { params: Promise<{ id: string; agentId: string }> };

async function verifyAccess(
  orgId: string,
  agentId: string,
  userId: string,
  requireWrite = false,
) {
  const memberResult = await requireOrgMember(orgId, userId, requireWrite ? "ADMIN" : undefined);
  if ("error" in memberResult) return { error: memberResult.error };

  const agent = await prisma.orgAgent.findFirst({
    where: { id: agentId, orgId },
  });
  if (!agent) return { error: jsonError("Агент не найден", 404) };

  return { member: memberResult.member, agent };
}

export async function POST(req: Request, { params }: RouteParams) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;
  const { id: orgId, agentId } = await params;

  const access = await verifyAccess(orgId, agentId, userId, true);
  if ("error" in access) return access.error;
  const { agent } = access;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return jsonError("Организация не найдена", 404);

  // Lazy-create namespace if needed
  let nsApiKey = org.nsApiKey ? decrypt(org.nsApiKey) : null;
  if (!nsApiKey) {
    try {
      const ns = await createNamespace(org.namespace, org.name);
      nsApiKey = ns.apiKey;
      await prisma.organization.update({
        where: { id: orgId },
        data: { nsApiKey: encrypt(nsApiKey) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания namespace";
      return jsonError(msg, 502);
    }
  }

  // Lazy-create project if needed
  let projectId = agent.projectId;
  if (!projectId) {
    try {
      const agentSlug = `agent_${agentId}`;
      const project = await createProject(nsApiKey, agentSlug, agent.name);
      projectId = project.id;
      await prisma.orgAgent.update({
        where: { id: agentId },
        data: { projectId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания проекта";
      return jsonError(msg, 502);
    }
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return jsonError("Неверные данные формы", 400);

  const file = formData.get("file") as File | null;
  if (!file) return jsonError("Файл не найден", 400);

  if (file.size > MAX_AGENT_FILE_SIZE) {
    return jsonError("Файл слишком большой (макс. 100MB)", 400);
  }

  // Check limits
  if (session.user.role !== "ADMIN") {
    const fileLimit = await checkOrgLimit(org.ownerId, "files", agentId);
    if (!fileLimit.allowed) return jsonError(fileLimit.error!, 403);
    const sizeCheck = await checkOrgFileSize(org.ownerId, file.size);
    if (!sizeCheck.allowed) return jsonError(sizeCheck.error!, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to S3
  const storageKey = `org/${orgId}/agents/${agentId}/${Date.now()}-${file.name}`;
  const fileUrl = storageKey;
  try {
    await uploadToS3(storageKey, buffer, file.type);
  } catch {
    // S3 not configured — store URL as key
  }

  // Upload to AI Cortex
  try {
    await uploadToCortex(nsApiKey, projectId!, buffer, file.name);
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

  return jsonOk({
    ...record,
    createdAt: record.createdAt.toISOString(),
  });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id: orgId, agentId } = await params;

  const access = await verifyAccess(orgId, agentId, userId, true);
  if ("error" in access) return access.error;

  const { fileId } = await req.json();

  const file = await prisma.orgAgentFile.findFirst({
    where: { id: fileId, orgAgentId: agentId },
  });
  if (!file) return jsonError("Файл не найден", 404);

  await prisma.orgAgentFile.delete({ where: { id: fileId } });

  return jsonOk({ success: true });
}
