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
      redirect: "manual",
    });

    // 1C returns 3xx redirect to login page on auth failure
    if (res.status >= 300 && res.status < 400) {
      return jsonOk({
        success: false,
        error: "Сервер перенаправляет на страницу входа — проверьте логин и пароль",
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonOk({
        success: false,
        error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      });
    }

    // Read body once, then validate content
    const body = await res.text().catch(() => "");

    // 1C may return 200 with HTML login page instead of JSON on auth failure
    if (body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html")) {
      return jsonOk({
        success: false,
        error: "Сервер вернул HTML вместо JSON — проверьте логин, пароль и URL OData",
      });
    }

    // Try parsing as JSON to confirm valid OData response
    try {
      JSON.parse(body);
    } catch {
      return jsonOk({
        success: false,
        error: `Ответ сервера не является валидным JSON: ${body.slice(0, 100)}`,
      });
    }

    return jsonOk({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonOk({ success: false, error: message.slice(0, 200) });
  }
}
