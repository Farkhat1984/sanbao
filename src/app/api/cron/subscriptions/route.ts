import { NextRequest, NextResponse } from "next/server";
import { runSubscriptionMaintenance } from "@/lib/subscription-manager";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSubscriptionMaintenance();

  return NextResponse.json({ ok: true, ...result });
}
