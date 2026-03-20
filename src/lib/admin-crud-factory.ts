import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

interface AdminCrudConfig {
  /** Prisma model name (camelCase, e.g. "webhook", "apiKey", "promptExperiment") */
  model: string;
  /** Fields allowed for PUT updates (whitelist to prevent mass assignment) */
  allowedUpdateFields: string[];
  /** 404 error message (Russian) */
  notFoundMsg: string;
  /** Optional: Prisma include for GET response */
  include?: Record<string, unknown>;
  /** Optional: Prisma include for PUT response */
  includeOnPut?: Record<string, unknown>;
  /** Optional: extra where conditions for findUnique (e.g. { isGlobal: true }) */
  findWhere?: Record<string, unknown>;
  /** Optional: transform record before returning from GET */
  transformGet?: (record: Record<string, unknown>) => unknown;
  /** Optional: transform record before returning from PUT */
  transformPut?: (record: Record<string, unknown>) => unknown;
  /** Optional: validate/transform before PUT. Return NextResponse to abort. */
  beforeUpdate?: (body: Record<string, unknown>, record: Record<string, unknown>) => Promise<NextResponse | void> | NextResponse | void;
  /** Optional: validate before DELETE. Return NextResponse to abort. */
  beforeDelete?: (record: Record<string, unknown>) => Promise<NextResponse | void> | NextResponse | void;
  /** Optional: callback after PUT (e.g. cache invalidation) */
  afterUpdate?: () => void;
  /** Optional: callback after DELETE (e.g. cache invalidation) */
  afterDelete?: () => void;
  /** Optional: transform field value before saving (e.g. encrypt, parse date) */
  transformField?: (field: string, value: unknown) => unknown;
}

/**
 * Prisma delegate accessor. Uses dynamic property access on the prisma client
 * since Prisma does not expose a generic delegate type.
 */
function getDelegate(model: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[model];
  if (!delegate) {
    throw new Error(`Prisma model "${model}" not found`);
  }
  return delegate;
}

/**
 * Factory that generates GET, PUT, DELETE route handlers for admin CRUD [id] routes.
 *
 * Eliminates the repetitive pattern of:
 *   requireAdmin() -> extract id -> findUnique -> 404 check -> operation -> jsonOk
 *
 * Usage:
 * ```ts
 * // src/app/api/admin/webhooks/[id]/route.ts
 * export const { GET, PUT, DELETE } = createAdminCrudHandlers({
 *   model: "webhook",
 *   allowedUpdateFields: ["url", "events", "isActive"],
 *   notFoundMsg: "Вебхук не найден",
 * });
 * ```
 */
export function createAdminCrudHandlers(config: AdminCrudConfig) {
  const {
    model,
    allowedUpdateFields,
    notFoundMsg,
    include,
    includeOnPut,
    findWhere,
    transformGet,
    transformPut,
    beforeUpdate,
    beforeDelete,
    afterUpdate,
    afterDelete,
    transformField,
  } = config;

  const delegate = getDelegate(model);

  async function GET(
    _req: Request,
    { params }: RouteParams,
  ): Promise<NextResponse> {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { id } = await params;
    const where = { id, ...findWhere };
    const record = await delegate.findUnique({
      where,
      ...(include ? { include } : {}),
    });

    if (!record) {
      return jsonError(notFoundMsg, 404);
    }

    return jsonOk(transformGet ? transformGet(record) : record);
  }

  async function PUT(
    req: Request,
    { params }: RouteParams,
  ): Promise<NextResponse> {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { id } = await params;
    const body = await req.json();
    const where = { id, ...findWhere };

    const existing = await delegate.findUnique({ where });
    if (!existing) {
      return jsonError(notFoundMsg, 404);
    }

    if (beforeUpdate) {
      const abort = await beforeUpdate(body, existing);
      if (abort) return abort;
    }

    const data: Record<string, unknown> = {};
    for (const field of allowedUpdateFields) {
      if (body[field] !== undefined) {
        data[field] = transformField
          ? transformField(field, body[field])
          : body[field];
      }
    }

    const updated = await delegate.update({
      where: { id },
      data,
      ...(includeOnPut ? { include: includeOnPut } : {}),
    });
    afterUpdate?.();

    return jsonOk(transformPut ? transformPut(updated) : updated);
  }

  async function DELETE(
    _req: Request,
    { params }: RouteParams,
  ): Promise<NextResponse> {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { id } = await params;
    const where = { id, ...findWhere };
    const existing = await delegate.findUnique({ where });
    if (!existing) {
      return jsonError(notFoundMsg, 404);
    }

    if (beforeDelete) {
      const abort = await beforeDelete(existing);
      if (abort) return abort;
    }

    await delegate.delete({ where: { id } });
    afterDelete?.();

    return jsonOk({ success: true });
  }

  return { GET, PUT, DELETE };
}
