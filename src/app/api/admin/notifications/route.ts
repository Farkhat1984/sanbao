import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import type { NotificationType } from "@prisma/client";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  // Backward compatible: if `page` param is present, fall back to offset pagination
  const pageParam = searchParams.get("page");
  if (pageParam && !cursor) {
    const page = parseInt(pageParam, 10) || 1;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count(),
    ]);
    return jsonOk({ notifications, total, page, limit });
  }

  // Cursor-based pagination (preferred)
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return jsonOk({ notifications: items, nextCursor, hasMore });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { title, message, type, userId, isGlobal } = body;

  if (!title || !message) {
    return jsonError("Обязательные поля: title, message", 400);
  }

  if (isGlobal) {
    // Global notification for all users
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: (type as NotificationType) || "INFO",
        isGlobal: true,
        userId: null,
      },
    });
    return jsonOk(notification, 201);
  }

  if (userId) {
    // Notification for specific user
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: (type as NotificationType) || "INFO",
        userId,
        isGlobal: false,
      },
    });
    return jsonOk(notification, 201);
  }

  // Mass notification — use global notification instead of per-user rows
  // This avoids OOM with 100k+ users
  const notification = await prisma.notification.create({
    data: {
      title,
      message,
      type: (type as NotificationType) || "INFO",
      isGlobal: true,
      userId: null,
    },
  });
  return jsonOk(notification, 201);
}
