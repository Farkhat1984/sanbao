const AI_CORTEX_URL = process.env.AI_CORTEX_URL || "http://orchestrator:8120";
const TIMEOUT_DEFAULT = 30_000;
const TIMEOUT_PROCESS = 120_000;

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
  const { timeout = TIMEOUT_DEFAULT, apiKey, ...fetchOptions } = options;

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
    body: JSON.stringify({ name, display_name: displayName }),
  });

  const keyRes = await cortexFetch(`/api/namespaces/${name}/keys`, {
    method: "POST",
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
  await cortexFetch(`/api/projects/${projectId}/process`, {
    method: "POST",
    apiKey: nsApiKey,
    timeout: TIMEOUT_PROCESS,
  });
}

export async function publishProject(
  nsApiKey: string,
  projectId: string
): Promise<{ endpoint: string; domain: string }> {
  const res = await cortexFetch(`/api/projects/${projectId}/publish`, {
    method: "POST",
    apiKey: nsApiKey,
    timeout: TIMEOUT_PROCESS,
  });
  const data = await res.json();
  const domain = data.domain || `project_${projectId}`;
  // Orchestrator serves published domains via the unified /mcp endpoint
  const endpoint = data.endpoint || data.mcp_endpoint || data.url || `${AI_CORTEX_URL}/mcp`;
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
