import { requireAuth, jsonOk, serializeDates } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { parsePagination } from "@/lib/validation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId);
  if ("error" in memberResult) return memberResult.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const [members, total] = await Promise.all([
    prisma.orgMember.findMany({
      where: { orgId: id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.orgMember.count({ where: { orgId: id } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return jsonOk({
    members: members.map(serializeDates),
    total,
    page,
    totalPages,
  });
}
