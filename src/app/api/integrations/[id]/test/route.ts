import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import { PROVIDER_TEST_TIMEOUT_MS } from "@/lib/constants";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if ("error" in result) return result.error;
  const { userId } = result.auth;
  const { id } = await params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId },
  });
  if (!integration) return jsonError("Интеграция не найдена", 404);

  const safe = await isUrlSafeAsync(integration.baseUrl);
  if (!safe) return jsonError("URL не прошёл проверку безопасности", 400);

  try {
    const basicAuth = decrypt(integration.credentials);
    const testUrl = `${integration.baseUrl}${integration.baseUrl.includes("?") ? "&" : "?"}$format=json&$top=1`;

    const res = await fetch(testUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonOk({
        success: false,
        error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      });
    }

    return jsonOk({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonOk({ success: false, error: message.slice(0, 200) });
  }
}
