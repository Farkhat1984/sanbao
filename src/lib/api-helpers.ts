import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { ZodError } from "zod";

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
 * JSON 400 response from a Zod validation error.
 * Extracts the first issue message for a user-friendly error.
 */
export function jsonValidationError(error: ZodError): NextResponse {
  const message = error.issues[0]?.message || "Ошибка валидации";
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * JSON 429 response with optional Retry-After header.
 */
export function jsonRateLimited(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds ?? 900),
      },
    }
  );
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
