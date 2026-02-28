import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const sessions = await prisma.session.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { expires: "desc" },
    take: 500,
  });

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      userEmail: s.user.email,
      expires: s.expires.toISOString(),
    }))
  );
}

export async function DELETE(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();

  if (body.all) {
    // Require explicit confirmation for bulk delete to prevent accidental mass session termination
    const url = new URL(req.url);
    if (url.searchParams.get("confirm") !== "true") {
      return NextResponse.json(
        { error: "Bulk delete requires ?confirm=true query parameter" },
        { status: 400 }
      );
    }

    // Exclude the current admin's session to prevent self-lockout
    await prisma.session.deleteMany({
      where: { userId: { not: result.userId } },
    });
    return NextResponse.json({ success: true, deleted: "all_except_current" });
  }

  if (body.sessionId) {
    await prisma.session.delete({ where: { id: body.sessionId } }).catch(() => null);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "sessionId or all required" }, { status: 400 });
}
