import { jsonOk } from "@/lib/api-helpers";

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL || "http://orchestrator:8120";
const CORTEX_TOKEN = process.env.AI_CORTEX_AUTH_TOKEN || null;

export async function GET() {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (CORTEX_TOKEN) headers["Authorization"] = `Bearer ${CORTEX_TOKEN}`;

    const res = await fetch(`${ORCHESTRATOR_URL}/api/link-registry`, {
      headers,
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) {
      return jsonOk({}, res.status);
    }

    const data = await res.json();
    return jsonOk(data);
  } catch (e) {
    console.error("Failed to fetch link registry:", e);
    return jsonOk({});
  }
}
