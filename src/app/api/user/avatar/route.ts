import { prisma } from "@/lib/prisma";
import { isUrlSafe } from "@/lib/ssrf";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

export async function PUT(req: Request) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result.auth;

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
    where: { id: userId },
    data: { image: avatar || null },
  });

  return jsonOk({ success: true });
}
