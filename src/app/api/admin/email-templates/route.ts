import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { EmailType } from "@prisma/client";

const VALID_TYPES = [
  "WELCOME",
  "INVOICE",
  "SUBSCRIPTION_EXPIRING",
  "PAYMENT_FAILED",
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
];

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { type: "asc" },
  });

  // Return all types, filling in defaults for missing ones
  const map = new Map(templates.map((t) => [t.type, t]));
  const all = VALID_TYPES.map((type) => {
    if (map.has(type as EmailType)) return map.get(type as EmailType);
    return { id: null, type, subject: "", html: "", isActive: false };
  });

  return NextResponse.json(all);
}

export async function PUT(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { type, subject, html, isActive } = body;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Неверный тип шаблона" }, { status: 400 });
  }

  const template = await prisma.emailTemplate.upsert({
    where: { type: type as EmailType },
    update: {
      subject: subject || "",
      html: html || "",
      isActive: isActive ?? true,
    },
    create: {
      type: type as EmailType,
      subject: subject || "",
      html: html || "",
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(template);
}
