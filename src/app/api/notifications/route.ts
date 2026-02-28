import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

/** GET — user's notifications */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { isGlobal: true },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk(notifications);
}

/** PUT — mark notifications as read */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const body = await req.json().catch(() => null);
  const ids = body?.ids;

  if (ids && Array.isArray(ids)) {
    const safeIds = ids.slice(0, 500);
    await prisma.notification.updateMany({
      where: { id: { in: safeIds }, userId: session.user.id },
      data: { isRead: true },
    });
  } else {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
  }

  return jsonOk({ success: true });
}
