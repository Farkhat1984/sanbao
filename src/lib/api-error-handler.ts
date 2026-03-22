import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────

/**
 * Standard Next.js route handler signature.
 * Supports both `(request)` and `(request, context)` forms.
 */
type RouteContext = { params: Promise<Record<string, string>> };

type RouteHandler = (
  request: NextRequest,
  context?: RouteContext,
) => Promise<NextResponse> | NextResponse;

// ─── Generic Error Response ──────────────────────────────

const GENERIC_ERROR_MESSAGE = "Internal server error";

function buildInternalErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: GENERIC_ERROR_MESSAGE, type: "internal" as const },
    { status: 500 },
  );
}

// ─── Error Handler Wrapper ───────────────────────────────

/**
 * Wraps a Next.js API route handler with standardized error handling.
 *
 * - `AppError` instances are converted to structured JSON responses.
 * - `rate_limit` errors include a `Retry-After` header when details provide it.
 * - Unknown errors are logged and returned as generic 500 responses.
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandler(async (request) => {
 *   const result = await requireAuth();
 *   if ("error" in result) return result.error;
 *
 *   const data = await fetchData();
 *   if (!data) throw AppError.notFound("Resource");
 *
 *   return jsonOk(data);
 * });
 * ```
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      return handleRouteError(error, request);
    }
  };
}

// ─── Error Processing ────────────────────────────────────

/**
 * Converts a caught error into a NextResponse.
 * Exported for use in catch blocks where `withErrorHandler` is not applicable
 * (e.g., streaming routes that need partial error handling).
 */
export function handleRouteError(
  error: unknown,
  request?: NextRequest,
): NextResponse {
  if (isAppError(error)) {
    return handleAppError(error, request);
  }

  return handleUnknownError(error, request);
}

function handleAppError(error: AppError, request?: NextRequest): NextResponse {
  // Log non-client errors (5xx and external)
  if (error.statusCode >= 500) {
    logger.error(error.message, {
      context: "api-error-handler",
      type: error.type,
      statusCode: error.statusCode,
      path: request?.nextUrl?.pathname,
      method: request?.method,
      ...(error.details && { details: error.details }),
      stack: error.stack,
    });
  } else {
    logger.debug(`Client error: ${error.message}`, {
      context: "api-error-handler",
      type: error.type,
      statusCode: error.statusCode,
      path: request?.nextUrl?.pathname,
    });
  }

  const response = error.toResponse();

  // Add Retry-After header for rate limit errors
  if (error.type === "rate_limit" && error.details?.retryAfterSeconds) {
    response.headers.set(
      "Retry-After",
      String(error.details.retryAfterSeconds),
    );
  }

  return response;
}

function handleUnknownError(
  error: unknown,
  request?: NextRequest,
): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`Unhandled error: ${message}`, {
    context: "api-error-handler",
    path: request?.nextUrl?.pathname,
    method: request?.method,
    stack,
  });

  return buildInternalErrorResponse();
}
