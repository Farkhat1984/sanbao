import { prisma } from "@/lib/prisma";
import { requireAuth, jsonOk, jsonError, serializeDates } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { isUrlSafeAsync } from "@/lib/ssrf";
import { INTEGRATION_DISCOVERY_TIMEOUT_MS } from "@/lib/constants";
import { buildHierarchicalCatalog } from "@/lib/odata-catalog";
import { invalidateAgentContextCache } from "@/lib/tool-resolver";

const ODATA_PREFIXES = [
  "Catalog",
  "Document",
  "AccumulationRegister",
  "InformationRegister",
  "AccountingRegister",
  "ChartOfAccounts",
  "ChartOfCalculationTypes",
  "ChartOfCharacteristicTypes",
] as const;

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

  // SSRF re-check at discovery time (defense in depth)
  const safe = await isUrlSafeAsync(integration.baseUrl);
  if (!safe) {
    await prisma.integration.update({
      where: { id },
      data: { status: "ERROR", statusMessage: "URL не прошёл проверку безопасности" },
    });
    return jsonError("URL не прошёл проверку безопасности", 400);
  }

  // Set status to DISCOVERING
  await prisma.integration.update({
    where: { id },
    data: { status: "DISCOVERING", statusMessage: null },
  });

  try {
    // Decrypt credentials
    const basicAuth = decrypt(integration.credentials);

    // Fetch OData root
    const odataUrl = `${integration.baseUrl}${integration.baseUrl.includes("?") ? "&" : "?"}$format=json`;
    const res = await fetch(odataUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(INTEGRATION_DISCOVERY_TIMEOUT_MS),
      redirect: "manual",
    });

    // 1C returns 3xx redirect to login page on auth failure
    if (res.status >= 300 && res.status < 400) {
      throw new Error("Сервер перенаправляет на страницу входа — проверьте логин и пароль");
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    // 1C may return 200 with HTML login page instead of JSON on auth failure
    const responseText = await res.text();
    if (responseText.trimStart().startsWith("<!DOCTYPE") || responseText.trimStart().startsWith("<html")) {
      throw new Error("Сервер вернул HTML вместо JSON — проверьте логин, пароль и URL OData");
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error(`Ответ сервера не является валидным JSON: ${responseText.slice(0, 100)}`);
    }
    const entities: string[] = ((json.value as Array<{ name: string }>) || []).map((v) => v.name);

    // Build discoveredEntities summary (OData prefix counts for UI)
    const discoveredEntities: Record<string, number> = {};
    for (const name of entities) {
      if (name.endsWith("_RecordType")) continue;
      for (const prefix of ODATA_PREFIXES) {
        if (name.startsWith(prefix + "_")) {
          // Skip sub-tables in count (same logic as before)
          const rest = name.slice(prefix.length + 1);
          if ((prefix === "Document" || prefix === "Catalog" || prefix.startsWith("ChartOf")) && rest.indexOf("_") > 0) {
            break; // sub-table, don't count
          }
          discoveredEntities[prefix] = (discoveredEntities[prefix] || 0) + 1;
          break;
        }
      }
    }
    const entityCount = Object.values(discoveredEntities).reduce((a, b) => a + b, 0);

    // Build hierarchical catalog (compact index + on-demand sections)
    // Uses LLM to categorize entities into business domains
    const hierarchical = await buildHierarchicalCatalog({
      integrationName: integration.name,
      baseUrl: integration.baseUrl,
      entities,
    });

    const catalog = JSON.stringify(hierarchical);

    // Update integration
    const updated = await prisma.integration.update({
      where: { id },
      data: {
        status: "CONNECTED",
        statusMessage: null,
        catalog,
        discoveredEntities,
        entityCount,
        lastDiscoveredAt: new Date(),
      },
      select: {
        id: true, name: true, type: true, baseUrl: true, status: true,
        statusMessage: true, entityCount: true, lastDiscoveredAt: true,
        catalog: true, discoveredEntities: true, createdAt: true, updatedAt: true,
      },
    });

    // Invalidate agent context cache for agents linked to this integration
    const linkedAgents = await prisma.agentIntegration.findMany({
      where: { integrationId: id },
      select: { agentId: true },
    });
    for (const { agentId } of linkedAgents) {
      invalidateAgentContextCache(agentId);
    }

    return jsonOk(serializeDates(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.integration.update({
      where: { id },
      data: {
        status: "ERROR",
        statusMessage: message.slice(0, 500),
      },
    });
    return jsonError(`Ошибка обнаружения: ${message.slice(0, 200)}`, 500);
  }
}
