import { NextResponse } from "next/server";

// ─── Error Types ─────────────────────────────────────────

/**
 * Discriminated error types with their default HTTP status codes.
 * Each type represents a specific failure category in the API layer.
 */
export const ERROR_TYPE_STATUS_MAP = {
  validation: 400,
  auth: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limit: 429,
  external: 502,
  internal: 500,
} as const;

export type AppErrorType = keyof typeof ERROR_TYPE_STATUS_MAP;

// ─── Error Response Shape ────────────────────────────────

interface AppErrorResponse {
  error: string;
  type: AppErrorType;
  details?: Record<string, unknown>;
}

// ─── AppError Class ──────────────────────────────────────

/**
 * Structured application error that maps to an HTTP response.
 *
 * Usage:
 * ```ts
 * throw new AppError("validation", "Email is required");
 * throw new AppError("not_found", "Agent not found", { agentId });
 * throw AppError.validation("Email is required");
 * ```
 */
export class AppError extends Error {
  public readonly type: AppErrorType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    type: AppErrorType,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.statusCode = ERROR_TYPE_STATUS_MAP[type];
    this.details = details;

    // Restore prototype chain (required when extending built-in classes)
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert to a NextResponse with the correct status code and structured body.
   */
  toResponse(): NextResponse<AppErrorResponse> {
    const body: AppErrorResponse = {
      error: this.message,
      type: this.type,
      ...(this.details && { details: this.details }),
    };
    return NextResponse.json(body, { status: this.statusCode });
  }

  // ─── Static Factories ────────────────────────────────

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("validation", message, details);
  }

  static auth(message = "Unauthorized"): AppError {
    return new AppError("auth", message);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError("forbidden", message);
  }

  static notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    return new AppError("not_found", message, id ? { id } : undefined);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("conflict", message, details);
  }

  static rateLimit(retryAfterSeconds?: number): AppError {
    return new AppError(
      "rate_limit",
      "Too many requests. Try again later.",
      retryAfterSeconds ? { retryAfterSeconds } : undefined,
    );
  }

  static external(service: string, message?: string): AppError {
    return new AppError(
      "external",
      message ?? `External service unavailable: ${service}`,
      { service },
    );
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError("internal", message);
  }
}

// ─── Type Guard ──────────────────────────────────────────

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
