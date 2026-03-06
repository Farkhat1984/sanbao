import { prisma } from "@/lib/prisma";
import { getUserPlanAndUsage } from "@/lib/usage";

interface LimitCheck {
  allowed: boolean;
  error?: string;
}

export async function checkOrgLimit(ownerId: string, type: "organizations"): Promise<LimitCheck>;
export async function checkOrgLimit(ownerId: string, type: "members", orgId: string): Promise<LimitCheck>;
export async function checkOrgLimit(ownerId: string, type: "agents", orgId: string): Promise<LimitCheck>;
export async function checkOrgLimit(ownerId: string, type: "files", orgAgentId: string): Promise<LimitCheck>;
export async function checkOrgLimit(
  ownerId: string,
  type: "organizations" | "members" | "agents" | "files",
  resourceId?: string
): Promise<LimitCheck> {
  const { plan } = await getUserPlanAndUsage(ownerId);
  if (!plan) return { allowed: false, error: "Нет тарифного плана" };

  switch (type) {
    case "organizations": {
      if (plan.maxOrganizations <= 0) return { allowed: false, error: "Создание организаций недоступно на вашем тарифе" };
      const count = await prisma.organization.count({ where: { ownerId } });
      if (count >= plan.maxOrganizations) {
        return { allowed: false, error: `Лимит организаций (${plan.maxOrganizations}). Перейдите на более высокий тариф.` };
      }
      return { allowed: true };
    }
    case "members": {
      if (plan.maxOrgMembers <= 0) return { allowed: false, error: "Приглашение участников недоступно" };
      const count = await prisma.orgMember.count({ where: { orgId: resourceId! } });
      if (count >= plan.maxOrgMembers) {
        return { allowed: false, error: `Лимит участников (${plan.maxOrgMembers}). Перейдите на более высокий тариф.` };
      }
      return { allowed: true };
    }
    case "agents": {
      if (plan.maxOrgAgents <= 0) return { allowed: false, error: "Создание агентов организации недоступно" };
      const count = await prisma.orgAgent.count({ where: { orgId: resourceId! } });
      if (count >= plan.maxOrgAgents) {
        return { allowed: false, error: `Лимит агентов организации (${plan.maxOrgAgents}). Перейдите на более высокий тариф.` };
      }
      return { allowed: true };
    }
    case "files": {
      if (plan.maxOrgFilesPerAgent <= 0) return { allowed: false, error: "Загрузка файлов недоступна" };
      const count = await prisma.orgAgentFile.count({ where: { orgAgentId: resourceId! } });
      if (count >= plan.maxOrgFilesPerAgent) {
        return { allowed: false, error: `Лимит файлов на агента (${plan.maxOrgFilesPerAgent}).` };
      }
      return { allowed: true };
    }
  }
}

export async function checkOrgFileSize(ownerId: string, fileSizeBytes: number): Promise<LimitCheck> {
  const { plan } = await getUserPlanAndUsage(ownerId);
  if (!plan) return { allowed: false, error: "Нет тарифного плана" };

  const maxBytes = plan.maxOrgFileSizeMb * 1024 * 1024;
  if (maxBytes > 0 && fileSizeBytes > maxBytes) {
    return { allowed: false, error: `Файл превышает лимит (${plan.maxOrgFileSizeMb} МБ)` };
  }
  return { allowed: true };
}
