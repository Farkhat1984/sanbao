import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  PROMPT_REGISTRY,
  PROMPT_META,
  resetPromptCache,
} from "@/lib/prompts";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const keys = Object.keys(PROMPT_REGISTRY);

  // Load all overrides from SystemSetting in one query
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: [...keys, "system_prompt_global"] } },
    select: { key: true, value: true, updatedAt: true },
  });
  const settingMap = new Map(settings.map((s) => [s.key, s]));

  const prompts = keys.map((key) => {
    const meta = PROMPT_META[key];
    // Check for override (including legacy key for prompt_system_global)
    const override = settingMap.get(key) ??
      (key === "prompt_system_global" ? settingMap.get("system_prompt_global") : undefined);
    const isOverridden = !!override?.value?.trim();

    return {
      key,
      label: meta?.label ?? key,
      description: meta?.description ?? "",
      currentValue: isOverridden ? override!.value : PROMPT_REGISTRY[key],
      isDefault: !isOverridden,
      updatedAt: override?.updatedAt ?? null,
    };
  });

  return NextResponse.json(prompts);
}

export async function PUT(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { key, content, changelog } = await req.json();

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Ключ обязателен" }, { status: 400 });
  }
  if (!(key in PROMPT_REGISTRY)) {
    return NextResponse.json({ error: `Неизвестный ключ промпта: ${key}` }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length < 10) {
    return NextResponse.json({ error: "Содержимое промпта слишком короткое (мин. 10 символов)" }, { status: 400 });
  }

  // Get next version number
  const last = await prisma.promptVersion.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;

  // Create version record + upsert SystemSetting in a transaction
  await prisma.$transaction([
    prisma.promptVersion.create({
      data: {
        key,
        content: content.trim(),
        version,
        authorId: result.userId!,
        changelog: changelog?.trim() || null,
      },
    }),
    prisma.systemSetting.upsert({
      where: { key },
      update: { value: content.trim() },
      create: { key, value: content.trim(), type: "string" },
    }),
  ]);

  resetPromptCache(key);

  return NextResponse.json({ success: true, version });
}

export async function DELETE(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { key } = await req.json();

  if (!key || !(key in PROMPT_REGISTRY)) {
    return NextResponse.json({ error: `Неизвестный ключ промпта: ${key}` }, { status: 400 });
  }

  // Delete override from SystemSetting (returns to default)
  await prisma.systemSetting.deleteMany({ where: { key } });

  // Also delete legacy key if resetting the global prompt
  if (key === "prompt_system_global") {
    await prisma.systemSetting.deleteMany({ where: { key: "system_prompt_global" } });
  }

  // Record the reset in version history
  const last = await prisma.promptVersion.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });
  await prisma.promptVersion.create({
    data: {
      key,
      content: PROMPT_REGISTRY[key],
      version: (last?.version ?? 0) + 1,
      authorId: result.userId!,
      changelog: "Сброс к значению по умолчанию",
    },
  });

  resetPromptCache(key);

  return NextResponse.json({ success: true });
}
