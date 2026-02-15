import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const server = await prisma.mcpServer.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!server) {
    return NextResponse.json({ error: "Не найден" }, { status: 404 });
  }

  await prisma.mcpServer.update({
    where: { id },
    data: {
      status: "DISCONNECTED",
      discoveredTools: undefined,
    },
  });

  return NextResponse.json({ status: "DISCONNECTED" });
}
