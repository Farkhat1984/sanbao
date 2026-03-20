import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface AuthContext {
  userId: string;
  session: { user: { id: string; role?: string; email?: string; name?: string | null } };
}

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<NextResponse> | NextResponse;

type AuthRouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function that wraps an API route handler with authentication.
 * Eliminates the repetitive `requireAuth()` + error check boilerplate.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, ctx, { userId }) => {
 *   const items = await prisma.item.findMany({ where: { userId } });
 *   return jsonOk(items);
 * });
 * ```
 */
export function withAuth(handler: AuthRouteHandler): RouteHandler {
  return async (req, ctx) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCtx: AuthContext = {
      userId: session.user.id,
      session: session as AuthContext["session"],
    };
    return handler(req, ctx, authCtx);
  };
}
