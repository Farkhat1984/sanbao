// ─── Composable API route middleware ───
// Usage:
//   export const POST = withAuth(withValidation(schema, async (req, { auth, body }) => {
//     return jsonOk({ ok: true });
//   }));

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z, type ZodSchema, type ZodError } from "zod";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ─── Types ───

interface AuthContext {
  userId: string;
  role?: string;
  email?: string;
  name?: string | null;
}

interface HandlerContext {
  auth?: AuthContext;
  body?: unknown;
}

type RouteHandler<T extends HandlerContext = HandlerContext> = (
  req: NextRequest,
  ctx: T,
) => Promise<NextResponse | Response> | NextResponse | Response;

// ─── withAuth ───

type WithAuthContext<T extends HandlerContext> = T & { auth: AuthContext };

/**
 * Require authenticated session. Injects `ctx.auth` with userId, role, email.
 */
export function withAuth<T extends HandlerContext>(
  handler: RouteHandler<WithAuthContext<T>>,
): RouteHandler<T> {
  return async (req, ctx) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCtx: AuthContext = {
      userId: session.user.id,
      role: session.user.role as string | undefined,
      email: session.user.email ?? undefined,
      name: session.user.name,
    };
    return handler(req, { ...ctx, auth: authCtx } as WithAuthContext<T>);
  };
}

// ─── withRateLimit ───

interface RateLimitOptions {
  /** Max requests per window */
  max: number;
  /** Window in milliseconds (default: 60_000) */
  windowMs?: number;
  /** Key prefix (default: "api") */
  prefix?: string;
  /** Extract key from context (default: userId from auth) */
  keyFn?: (req: NextRequest, ctx: HandlerContext) => string | null;
}

/**
 * Rate limit the request. Must be used after withAuth if keyFn depends on auth.
 */
export function withRateLimit<T extends HandlerContext>(
  options: RateLimitOptions,
  handler: RouteHandler<T>,
): RouteHandler<T> {
  return async (req, ctx) => {
    const prefix = options.prefix ?? "api";
    const windowMs = options.windowMs ?? 60_000;
    const key = options.keyFn
      ? options.keyFn(req, ctx)
      : (ctx as HandlerContext & { auth?: AuthContext }).auth?.userId ?? null;
    if (!key) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = await checkRateLimit(`${prefix}:${key}`, options.max, windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } },
      );
    }
    return handler(req, ctx);
  };
}

// ─── withValidation ───

type WithBodyContext<T extends HandlerContext, S extends ZodSchema> = T & {
  body: z.infer<S>;
};

/**
 * Parse and validate request body with a Zod schema. Injects `ctx.body`.
 */
export function withValidation<T extends HandlerContext, S extends ZodSchema>(
  schema: S,
  handler: RouteHandler<WithBodyContext<T, S>>,
): RouteHandler<T> {
  return async (req, ctx) => {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const result = schema.safeParse(rawBody);
    if (!result.success) {
      const zodError = result.error as ZodError;
      const message = zodError.issues[0]?.message || "Validation error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handler(req, { ...ctx, body: result.data } as WithBodyContext<T, S>);
  };
}

// ─── withErrorHandler ───

/**
 * Catch unhandled errors, log them, and return a 500 response.
 */
export function withErrorHandler<T extends HandlerContext>(
  handler: RouteHandler<T>,
): RouteHandler<T> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      logger.error("Unhandled API error", {
        context: "API",
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

// ─── Compose helper ───

/**
 * Compose multiple middleware wrappers (right-to-left).
 *
 * Usage:
 *   const handler = compose(withErrorHandler, withAuth, withRateLimit({ max: 10 }))(
 *     async (req, ctx) => jsonOk({ ok: true })
 *   );
 */
export function compose(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...wrappers: Array<(handler: RouteHandler<any>) => RouteHandler<any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (handler: RouteHandler<any>) => RouteHandler<any> {
  return (handler) => wrappers.reduceRight((h, wrapper) => wrapper(h), handler);
}
