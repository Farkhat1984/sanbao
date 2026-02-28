import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { invalidateAgentContextCache } from "@/lib/tool-resolver";
import { z } from "zod";

const toolUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  icon: z.string().max(100).optional(),
  iconColor: z.string().max(50).optional(),
  type: z.enum(["PROMPT_TEMPLATE", "WEBHOOK", "URL", "FUNCTION"]).optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  inputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;
  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      agents: { include: { agent: { select: { id: true, name: true } } } },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { id } = await params;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = toolUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const body = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.iconColor !== undefined) data.iconColor = body.iconColor;
  if (body.type !== undefined) data.type = body.type;
  if (body.config !== undefined) data.config = body.config ?? undefined;
  if (body.inputSchema !== undefined) data.inputSchema = body.inputSchema ?? undefined;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const updated = await prisma.tool.update({
    where: { id },
    data,
  });

  // Invalidate agent context cache since tool config changed
  invalidateAgentContextCache();

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
  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.tool.delete({ where: { id } });
  invalidateAgentContextCache();
  return NextResponse.json({ ok: true });
}
