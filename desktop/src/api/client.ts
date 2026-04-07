const DEFAULT_BASE_URL = 'http://127.0.0.1:3456'

let baseUrl = DEFAULT_BASE_URL

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, '')
}

export function getBaseUrl() {
  return baseUrl
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => res.text())
    throw new ApiError(res.status, errorBody)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
