import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { expires: "desc" },
      skip,
      take: limit,
    }),
    prisma.session.count(),
  ]);

  return jsonOk({
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      userEmail: s.user.email,
      expires: s.expires.toISOString(),
    })),
    total,
    page,
    limit,
  });
}

export async function DELETE(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();

  if (body.all) {
    // Require explicit confirmation for bulk delete to prevent accidental mass session termination
    const url = new URL(req.url);
    if (url.searchParams.get("confirm") !== "true") {
      return jsonError("Bulk delete requires ?confirm=true query parameter", 400);
    }

    // Exclude the current admin's session to prevent self-lockout
    await prisma.session.deleteMany({
      where: { userId: { not: result.userId } },
    });
    return jsonOk({ success: true, deleted: "all_except_current" });
  }

  if (body.sessionId) {
    await prisma.session.delete({ where: { id: body.sessionId } }).catch(() => null);
    return jsonOk({ success: true });
  }

  return jsonError("sessionId or all required", 400);
}
