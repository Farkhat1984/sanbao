import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isUrlSafe } from "@/lib/ssrf";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const server = await prisma.mcpServer.findUnique({ where: { id } });
  if (!server || !server.isGlobal) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }

  const allowedFields = ["name", "url", "transport", "apiKey", "status", "isEnabled"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  if (typeof data.url === "string" && !isUrlSafe(data.url)) {
    return NextResponse.json({ error: "URL заблокирован (SSRF protection)" }, { status: 400 });
  }

  const updated = await prisma.mcpServer.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const server = await prisma.mcpServer.findUnique({ where: { id } });
  if (!server || !server.isGlobal) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }

  await prisma.mcpServer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
