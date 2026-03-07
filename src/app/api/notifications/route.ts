import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

/** GET — user's notifications with cursor-based pagination */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  const where = {
    OR: [
      { userId: session.user.id },
      { isGlobal: true },
    ],
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return jsonOk({ notifications: items, nextCursor, hasMore });
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
