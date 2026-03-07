import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await params;

  const server = await prisma.mcpServer.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!server) {
    return jsonError("Не найден", 404);
  }

  await prisma.mcpServer.update({
    where: { id },
    data: {
      status: "DISCONNECTED",
      discoveredTools: undefined,
    },
  });

  return jsonOk({ status: "DISCONNECTED" });
}
