import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    return jsonError("Plan not found", 404);
  }

  const allowedFields = [
    "name",
    "description",
    "price",
    "messagesPerDay",
    "tokensPerMessage",
    "tokensPerMonth",
    "requestsPerMinute",
    "contextWindowSize",
    "maxConversations",
    "maxAgents",
    "documentsPerMonth",
    "canUseAdvancedTools",
    "canUseReasoning",
    "canUseSkills",
    "canUseRag",
    "canUseGraph",
    "canChooseProvider",
    "isDefault",
    "sortOrder",
    "highlighted",
    "maxStorageMb",
    "maxOrganizations",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (data.isDefault === true) {
    await prisma.plan.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.plan.update({
    where: { id },
    data,
  });

  return jsonOk(updated);
}
