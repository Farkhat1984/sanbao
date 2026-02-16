import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count(),
  ]);

  return NextResponse.json({ notifications, total, page, limit });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { title, message, type, userId, isGlobal } = body;

  if (!title || !message) {
    return NextResponse.json({ error: "Обязательные поля: title, message" }, { status: 400 });
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
    return NextResponse.json(notification, { status: 201 });
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
    return NextResponse.json(notification, { status: 201 });
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
  return NextResponse.json(notification, { status: 201 });
}
