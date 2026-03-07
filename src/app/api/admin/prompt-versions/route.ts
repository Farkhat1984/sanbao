import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "global_system_prompt";

  const versions = await prisma.promptVersion.findMany({
    where: { key },
    orderBy: { version: "desc" },
    take: 50,
  });

  return jsonOk(versions);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { key, content, changelog } = await req.json();
  if (!key || !content) {
    return jsonError("key and content required", 400);
  }

  // Get next version
  const last = await prisma.promptVersion.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });

  const version = (last?.version || 0) + 1;

  const pv = await prisma.promptVersion.create({
    data: {
      key,
      content,
      version,
      authorId: result.userId!,
      changelog: changelog || null,
    },
  });

  // Also update the SystemSetting
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: content },
    create: { key, value: content, type: "string" },
  });

  return jsonOk(pv, 201);
}
