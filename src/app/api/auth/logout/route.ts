import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Stateless JWT — no server-side invalidation needed.
 * Client should discard the token.
 */
export async function POST() {
  return NextResponse.json({ success: true });
}
