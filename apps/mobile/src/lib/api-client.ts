/**
 * Mobile API client for Sanbao backend.
 *
 * - Bearer token auth via Capacitor Preferences
 * - NDJSON streaming for /api/chat
 * - Auto-retry on 401 (clears token, redirects to login)
 * - Same interface shape as web's api-client for consistency
 */

import { getToken, clearToken } from './auth'
import type { StreamChunk } from '@/types'

const DEFAULT_BASE_URL = 'https://sanbao.ai'

function getBaseUrl(): string {
  return (
    import.meta.env.VITE_API_BASE_URL ??
    DEFAULT_BASE_URL
  )
}

/** Error thrown when API response is not ok (status >= 400). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody
  } catch {
    return {}
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retry = true,
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`

  const authHeaders = await getAuthHeaders()
  const headers = {
    ...authHeaders,
    ...init?.headers,
  }

  const res = await fetch(url, { ...init, headers })

  /* Auto-clear on 401 and signal caller */
  if (res.status === 401 && retry) {
    await clearToken()
    throw new ApiError('Сессия истекла. Войдите снова.', 401, 'UNAUTHORIZED')
  }

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new ApiError(
      body.error ?? `Ошибка запроса: ${res.status}`,
      res.status,
      body.code,
      body.details,
    )
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

/**
 * Typed mobile API client.
 *
 * @example
 * ```ts
 * const data = await api.get<{ conversations: Conversation[] }>('/api/conversations')
 * await api.post('/api/conversations', { agentId: '...' })
 * ```
 */
export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}

/**
 * Stream NDJSON from /api/chat.
 *
 * Yields parsed `StreamChunk` objects ({ t, v }) as they arrive.
 * Throws `ApiError` on HTTP errors. The caller should handle
 * abort signals for cancellation.
 */
export async function* streamChat(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = getBaseUrl()
  const authHeaders = await getAuthHeaders()

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const errBody = await parseErrorBody(res)
    throw new ApiError(
      errBody.error ?? `Ошибка стрима: ${res.status}`,
      res.status,
      errBody.code,
    )
  }

  if (!res.body) {
    throw new ApiError('Пустой ответ от сервера', 500)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      /* Keep the last incomplete line in the buffer */
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const chunk = JSON.parse(trimmed) as StreamChunk
          yield chunk
        } catch {
          /* Skip malformed lines */
        }
      }
    }

    /* Flush remaining buffer */
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim()) as StreamChunk
      } catch {
        /* ignore */
      }
    }
  } finally {
    reader.releaseLock()
  }
}
