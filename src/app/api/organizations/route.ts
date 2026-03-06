import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { orgCreateSchema } from "@/lib/validation";
import { generateUniqueSlug } from "@/lib/slugify";
import { checkOrgLimit } from "@/lib/org-limits";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          _count: { select: { members: true, agents: true } },
        },
      },
    },
    orderBy: { org: { createdAt: "desc" } },
  });

  const organizations = memberships.map((m) => ({
    ...serializeDates(m.org),
    role: m.role,
    memberCount: m.org._count.members,
    agentCount: m.org._count.agents,
  }));

  return jsonOk(organizations);
}

export async function POST(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = orgCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }

  // Check plan limits (admins bypass)
  if (session.user.role !== "ADMIN") {
    const limit = await checkOrgLimit(userId, "organizations");
    if (!limit.allowed) return jsonError(limit.error!, 403);
  }

  const slug = await generateUniqueSlug(parsed.data.name);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: parsed.data.name,
        slug,
        ownerId: userId,
        avatar: parsed.data.avatar || null,
        namespace: "", // placeholder, will be set to id
      },
    });

    // Set namespace = id
    const updated = await tx.organization.update({
      where: { id: created.id },
      data: { namespace: created.id },
    });

    // Add owner as OWNER member
    await tx.orgMember.create({
      data: { orgId: created.id, userId, role: "OWNER" },
    });

    return updated;
  });

  await logAudit({
    actorId: userId,
    action: "CREATE",
    target: "Organization",
    targetId: org.id,
    details: { name: org.name, slug: org.slug },
  });

  return jsonOk(serializeDates({ ...org, role: "OWNER", memberCount: 1, agentCount: 0 }), 201);
}
