import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";

const VALID_LOCALES = ["ru", "kk"];

export async function GET() {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });

  return jsonOk({ locale: user?.locale ?? "ru" });
}

export async function PUT(req: Request) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Неверный JSON", 400);

  const { locale } = body;
  if (!locale || !VALID_LOCALES.includes(locale)) {
    return jsonError("Неверный язык", 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { locale },
  });

  return jsonOk({ locale });
}
