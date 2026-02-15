import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const servers = await prisma.mcpServer.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(servers);
}

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const body = await req.json();
  const { name, url, transport, apiKey } = body;

  if (!name || !url) {
    return NextResponse.json({ error: "Обязательные поля: name, url" }, { status: 400 });
  }

  const server = await prisma.mcpServer.create({
    data: {
      name,
      url,
      transport: transport || "SSE",
      apiKey: apiKey || null,
      isGlobal: true,
      isEnabled: body.isEnabled !== false,
      userId: null,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
