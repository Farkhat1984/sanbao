import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const plugin = await prisma.plugin.findUnique({
    where: { id },
    include: {
      tools: { include: { tool: true } },
      skills: { include: { skill: true } },
      mcpServers: { include: { mcpServer: true } },
    },
  });

  if (!plugin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...plugin,
    createdAt: plugin.createdAt.toISOString(),
    updatedAt: plugin.updatedAt.toISOString(),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const body = await req.json();

  const updated = await prisma.plugin.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.iconColor !== undefined && { iconColor: body.iconColor }),
      ...(body.version !== undefined && { version: body.version }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  // Update attached items if provided
  if (body.toolIds !== undefined) {
    await prisma.pluginTool.deleteMany({ where: { pluginId: id } });
    if (body.toolIds.length > 0) {
      await prisma.pluginTool.createMany({
        data: body.toolIds.map((toolId: string) => ({ pluginId: id, toolId })),
      });
    }
  }

  if (body.skillIds !== undefined) {
    await prisma.pluginSkill.deleteMany({ where: { pluginId: id } });
    if (body.skillIds.length > 0) {
      await prisma.pluginSkill.createMany({
        data: body.skillIds.map((skillId: string) => ({ pluginId: id, skillId })),
      });
    }
  }

  if (body.mcpServerIds !== undefined) {
    await prisma.pluginMcpServer.deleteMany({ where: { pluginId: id } });
    if (body.mcpServerIds.length > 0) {
      await prisma.pluginMcpServer.createMany({
        data: body.mcpServerIds.map((mcpServerId: string) => ({ pluginId: id, mcpServerId })),
      });
    }
  }

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const existing = await prisma.plugin.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.plugin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
