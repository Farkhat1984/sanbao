import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { PROVIDER_TEST_TIMEOUT_MS } from "@/lib/constants";

export async function POST(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  const { providerId } = await req.json();
  if (!providerId) {
    return jsonError("providerId is required", 400);
  }

  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    return jsonError("Provider not found", 404);
  }

  try {
    const start = Date.now();
    const apiKey = decrypt(provider.apiKey);
    const res = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TEST_TIMEOUT_MS),
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return jsonOk({
        success: false,
        status: res.status,
        latency,
        error: text.slice(0, 500),
      });
    }

    const data = await res.json().catch(() => ({}));
    const modelCount = Array.isArray(data?.data) ? data.data.length : 0;

    return jsonOk({
      success: true,
      status: res.status,
      latency,
      modelCount,
    });
  } catch (err) {
    return jsonOk({
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
      latency: 0,
    });
  }
}
