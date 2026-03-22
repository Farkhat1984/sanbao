import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/validation";
import { jsonOk } from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role"); // USER | ADMIN
  const plan = searchParams.get("plan"); // plan slug
  const { page, limit } = parsePagination(searchParams);
  const skip = (page - 1) * limit;

  const conditions: Prisma.UserWhereInput[] = [];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (role && ["USER", "ADMIN"].includes(role)) {
    conditions.push({ role: role as "USER" | "ADMIN" });
  }

  if (plan) {
    if (plan === "none") {
      conditions.push({ subscription: null });
    } else {
      conditions.push({ subscription: { plan: { slug: plan } } });
    }
  }

  const where: Prisma.UserWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            plan: { select: { slug: true, name: true } },
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return jsonOk({ users, total, page, limit });
}
