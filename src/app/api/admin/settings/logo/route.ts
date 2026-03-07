import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { MAX_LOGO_SIZE } from "@/lib/constants";
import { jsonOk, jsonError } from "@/lib/api-helpers";

const MAX_SIZE = MAX_LOGO_SIZE;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return jsonError("No file provided", 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return jsonError("Допустимые форматы: PNG, JPEG, SVG, WebP", 400);
  }

  if (file.size > MAX_SIZE) {
    return jsonError("Максимальный размер файла: 512 КБ", 400);
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  await prisma.systemSetting.upsert({
    where: { key: "app_logo" },
    update: { value: dataUrl },
    create: { key: "app_logo", value: dataUrl },
  });

  return jsonOk({ url: dataUrl });
}

export async function DELETE() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  await prisma.systemSetting.deleteMany({ where: { key: "app_logo" } });

  return jsonOk({ success: true });
}
