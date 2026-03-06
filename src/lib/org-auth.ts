import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import type { OrgRole } from "@prisma/client";
import type { NextResponse } from "next/server";

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export async function requireOrgMember(
  orgId: string,
  userId: string,
  minRole?: OrgRole
): Promise<{ member: { id: string; orgId: string; userId: string; role: OrgRole } } | { error: NextResponse }> {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });

  if (!member) {
    return { error: jsonError("Вы не являетесь участником организации", 403) };
  }

  if (minRole && ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[minRole]) {
    return { error: jsonError("Недостаточно прав", 403) };
  }

  return { member };
}
