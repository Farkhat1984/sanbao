import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { avatar } = await req.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: avatar || null },
  });

  return NextResponse.json({ success: true });
}
