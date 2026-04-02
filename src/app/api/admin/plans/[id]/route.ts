import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";
import { prisma } from "@/lib/prisma";

export const { PUT } = createAdminCrudHandlers({
  model: "plan",
  allowedUpdateFields: [
    "name", "description", "price", "messagesPerDay", "tokensPerMessage",
    "tokensPerMonth", "requestsPerMinute", "contextWindowSize",
    "maxConversations", "maxAgents", "documentsPerMonth",
    "canUseAgents", "canUseMultiAgents", "canUseReasoning", "canUseSkills",
    "canUseRag", "canUseGraph", "canChooseProvider",
    "isDefault", "sortOrder", "highlighted", "maxStorageMb", "maxOrganizations",
  ],
  notFoundMsg: "Plan not found",
  beforeUpdate: async (body) => {
    if (body.isDefault === true) {
      await prisma.plan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
  },
});
