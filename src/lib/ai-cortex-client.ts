import { getSettingNumber } from "@/lib/settings";

const AI_CORTEX_URL = process.env.AI_CORTEX_URL || "http://orchestrator:8120";
const AI_CORTEX_MASTER_KEY = process.env.AI_CORTEX_AUTH_TOKEN || "";

/** Fallback values used when settings DB is unavailable */
const TIMEOUT_DEFAULT_FALLBACK = 30_000;
const TIMEOUT_PROCESS_FALLBACK = 120_000;

class AiCortexError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "AiCortexError";
  }
}

async function cortexFetch(
  path: string,
  options: RequestInit & { timeout?: number; apiKey?: string } = {}
): Promise<Response> {
  const defaultTimeout = await getSettingNumber("ai_cortex_timeout_default_ms")
    .catch(() => TIMEOUT_DEFAULT_FALLBACK);
  const { timeout = defaultTimeout, apiKey, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Don't set Content-Type for FormData
  if (!(fetchOptions.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${AI_CORTEX_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AiCortexError(
        `AI Cortex ${path} failed: ${res.status} ${text}`,
        res.status
      );
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function createNamespace(
  name: string,
  displayName: string
): Promise<{ name: string; apiKey: string }> {
  await cortexFetch("/api/namespaces", {
    method: "POST",
    apiKey: AI_CORTEX_MASTER_KEY,
    body: JSON.stringify({ name, display_name: displayName }),
  });

  const keyRes = await cortexFetch(`/api/namespaces/${name}/keys`, {
    method: "POST",
    apiKey: AI_CORTEX_MASTER_KEY,
    body: JSON.stringify({ description: `Sanbao org: ${displayName}` }),
  });

  const keyData = await keyRes.json();
  return { name, apiKey: keyData.key || keyData.api_key };
}

export async function createProject(
  nsApiKey: string,
  name: string,
  displayName: string
): Promise<{ id: string }> {
  const res = await cortexFetch("/api/projects", {
    method: "POST",
    apiKey: nsApiKey,
    body: JSON.stringify({ name, display_name: displayName }),
  });
  const data = await res.json();
  return { id: data.id || data.project_id };
}

export async function uploadFile(
  nsApiKey: string,
  projectId: string,
  file: Buffer | Blob,
  fileName: string
): Promise<void> {
  const formData = new FormData();
  const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)]);
  formData.append("file", blob, fileName);

  await cortexFetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    apiKey: nsApiKey,
    body: formData,
    timeout: 60_000,
  });
}

export async function processProject(
  nsApiKey: string,
  projectId: string
): Promise<void> {
  const timeoutProcess = await getSettingNumber("ai_cortex_timeout_process_ms")
    .catch(() => TIMEOUT_PROCESS_FALLBACK);
  await cortexFetch(`/api/projects/${projectId}/process`, {
    method: "POST",
    apiKey: nsApiKey,
    timeout: timeoutProcess,
  });
}

export async function reprocessProject(
  nsApiKey: string,
  projectId: string
): Promise<void> {
  const timeoutProcess = await getSettingNumber("ai_cortex_timeout_process_ms")
    .catch(() => TIMEOUT_PROCESS_FALLBACK);
  await cortexFetch(`/api/projects/${projectId}/reprocess`, {
    method: "POST",
    apiKey: nsApiKey,
    timeout: timeoutProcess,
  });
}

export async function publishProject(
  nsApiKey: string,
  projectId: string,
  agentName?: string
): Promise<{ endpoint: string; domain: string }> {
  const timeoutProcess = await getSettingNumber("ai_cortex_timeout_process_ms")
    .catch(() => TIMEOUT_PROCESS_FALLBACK);
  const body: Record<string, string> = {};
  if (agentName) body.agent_name = agentName;

  const res = await cortexFetch(`/api/projects/${projectId}/publish`, {
    method: "POST",
    apiKey: nsApiKey,
    timeout: timeoutProcess,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const domain = data.domain || `project_${projectId}`;
  // Use per-domain MCP endpoint (auto-injects domain into tool args)
  const endpoint = data.endpoint
    ? `${AI_CORTEX_URL}${data.endpoint}`
    : `${AI_CORTEX_URL}/mcp/${domain}`;
  return { endpoint, domain };
}

export async function getProjectProgress(
  nsApiKey: string,
  projectId: string
): Promise<Response> {
  // Direct fetch without AbortController — SSE streams need to stay open
  const res = await fetch(`${AI_CORTEX_URL}/api/projects/${projectId}/progress`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${nsApiKey}`,
      Accept: "text/event-stream",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AiCortexError(
      `AI Cortex progress failed: ${res.status} ${text}`,
      res.status,
    );
  }
  return res;
}

export async function deleteProject(
  nsApiKey: string,
  projectId: string
): Promise<void> {
  await cortexFetch(`/api/projects/${projectId}`, {
    method: "DELETE",
    apiKey: nsApiKey,
  });
}
