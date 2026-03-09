/**
 * Frontend API client — eliminates repetitive fetch + JSON boilerplate.
 * Auto-sets Content-Type, parses JSON responses, and throws typed errors.
 */

/** Error thrown when API response is not ok (status >= 400). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return {};
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(
      body.error ?? `Request failed: ${res.status}`,
      res.status,
      body.code,
      body.details,
    );
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Typed API client for frontend fetch calls.
 *
 * Usage:
 * ```ts
 * const data = await api.get<{ users: User[] }>("/api/admin/users");
 * await api.post("/api/admin/webhooks", { url: "https://..." });
 * await api.put(`/api/admin/webhooks/${id}`, { isActive: false });
 * await api.delete(`/api/admin/webhooks/${id}`);
 * ```
 */
export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },

  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: "POST",
      headers: JSON_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
  },
};
