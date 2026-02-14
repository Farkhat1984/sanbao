import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { MAX_LOGO_SIZE } from "@/lib/constants";

const MAX_SIZE = MAX_LOGO_SIZE;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Допустимые форматы: PNG, JPEG, SVG, WebP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Максимальный размер файла: 512 КБ" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  await prisma.systemSetting.upsert({
    where: { key: "app_logo" },
    update: { value: dataUrl },
    create: { key: "app_logo", value: dataUrl },
  });

  return NextResponse.json({ url: dataUrl });
}

export async function DELETE() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  await prisma.systemSetting.deleteMany({ where: { key: "app_logo" } });

  return NextResponse.json({ success: true });
}
