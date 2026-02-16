import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUrlSafe } from "@/lib/ssrf";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { avatar } = await req.json();

  // Validate avatar URL to prevent XSS
  if (avatar) {
    if (typeof avatar !== "string" || avatar.length > 2000) {
      return NextResponse.json({ error: "Некорректный URL аватара" }, { status: 400 });
    }
    if (!isUrlSafe(avatar)) {
      return NextResponse.json({ error: "Недопустимый URL аватара" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: avatar || null },
  });

  return NextResponse.json({ success: true });
}
