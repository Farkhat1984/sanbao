import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const { avatar } = await req.json();

  // Validate avatar URL to prevent XSS
  if (avatar) {
    if (typeof avatar !== "string" || avatar.length > 2000) {
      return jsonError("Некорректный URL аватара", 400);
    }
    if (!isUrlSafe(avatar)) {
      return jsonError("Недопустимый URL аватара", 400);
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: avatar || null },
  });

  return jsonOk({ success: true });
}
