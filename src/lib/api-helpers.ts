import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface AuthResult {
  userId: string;
  session: { user: { id: string; role?: string; email?: string; name?: string | null } };
}

/**
 * Require authenticated user session. Returns userId + session or error response.
 */
export async function requireAuth(): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return {
    auth: {
      userId: session.user.id,
      session: session as AuthResult["session"],
    },
  };
}

/**
 * JSON success response with optional status code.
 */
export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * JSON error response.
 */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Recursively serialize Date fields to ISO strings.
 */
export function serializeDates<T>(obj: T): T {
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}
