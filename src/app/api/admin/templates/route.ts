import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;
  const type = searchParams.get("type");
  const jurisdiction = searchParams.get("jurisdiction");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (jurisdiction) where.jurisdiction = jurisdiction;

  const [templates, total] = await Promise.all([
    prisma.documentTemplate.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.documentTemplate.count({ where }),
  ]);

  return jsonOk({ templates, total, page, limit });
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, type, content, jurisdiction, isActive } = body;

  if (!name || !type || !content) {
    return jsonError("Обязательные поля: name, type, content", 400);
  }

  const template = await prisma.documentTemplate.create({
    data: {
      name,
      type,
      content,
      jurisdiction: jurisdiction || "RU",
      isActive: isActive ?? true,
    },
  });

  return jsonOk(template, 201);
}
