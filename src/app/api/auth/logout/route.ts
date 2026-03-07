import { jsonOk } from "@/lib/api-helpers";

/**
 * POST /api/auth/logout
 * Stateless JWT — no server-side invalidation needed.
 * Client should discard the token.
 */
export async function POST() {
  return jsonOk({ success: true });
}
