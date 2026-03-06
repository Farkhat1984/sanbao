import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/org-auth";
import { orgInviteSchema } from "@/lib/validation";
import { checkOrgLimit } from "@/lib/org-limits";
import { sendEmail, orgInviteEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const INVITE_EXPIRY_DAYS = 7;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId, session } = result.auth;
  const { id } = await params;

  const memberResult = await requireOrgMember(id, userId, "ADMIN");
  if ("error" in memberResult) return memberResult.error;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const parsed = orgInviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Ошибка валидации", 400);
  }

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    const existingMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: id, userId: existingUser.id } },
    });
    if (existingMember) return jsonError("Пользователь уже является участником", 409);
  }

  // Check pending invite
  const existingInvite = await prisma.orgInvite.findFirst({
    where: { orgId: id, email: parsed.data.email, status: "PENDING" },
  });
  if (existingInvite) return jsonError("Приглашение уже отправлено", 409);

  // Check member limit
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return jsonError("Организация не найдена", 404);

  if (session.user.role !== "ADMIN") {
    const limit = await checkOrgLimit(org.ownerId, "members", id);
    if (!limit.allowed) return jsonError(limit.error!, 403);
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const invite = await prisma.orgInvite.create({
    data: {
      orgId: id,
      email: parsed.data.email,
      role: parsed.data.role,
      expiresAt,
    },
  });

  // Send email
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://sanbao.ai";
  const inviteUrl = `${baseUrl}/invite/${invite.token}`;

  const { subject, html } = await orgInviteEmail({
    orgName: org.name,
    inviterName: session.user.name || session.user.email || "Пользователь",
    role: parsed.data.role,
    inviteUrl,
  });

  await sendEmail({
    to: parsed.data.email,
    subject,
    html,
    type: "ORG_INVITE",
    userId: existingUser?.id,
    metadata: { orgId: id, inviteId: invite.id },
  });

  await logAudit({
    actorId: userId,
    action: "INVITE",
    target: "Organization",
    targetId: id,
    details: { email: parsed.data.email, role: parsed.data.role },
  });

  return jsonOk({ success: true, inviteId: invite.id }, 201);
}
