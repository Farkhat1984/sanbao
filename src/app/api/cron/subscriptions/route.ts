import { NextRequest } from "next/server";
import { runSubscriptionMaintenance } from "@/lib/subscription-manager";
import { timingSafeEqual } from "crypto";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return jsonError("CRON_SECRET not configured", 500);
  }
  const expectedFull = `Bearer ${expected}`;
  if (
    authHeader.length !== expectedFull.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedFull))
  ) {
    return jsonError("Unauthorized", 401);
  }

  const result = await runSubscriptionMaintenance();

  return jsonOk({ ok: true, ...result });
}
