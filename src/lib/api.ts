import { readJson } from "@/lib/json"

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// Fetches JSON from our API. A 204 comes back as null, so include null in `T`
// for routes that can return one. A 401 means the session is gone, so it
// sends the user to sign in and back here after.
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Accept", "application/json")
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(path, { ...init, headers })

  if (res.status === 401) {
    const here = window.location.pathname + window.location.search
    window.location.assign(`/login?redirect=${encodeURIComponent(here)}`)
  }
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res))
  }
  if (res.status === 204) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return null as T
  }
  return await readJson<T>(res)
}

function hasError(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  )
}

async function errorMessage(res: Response) {
  const fallback = `${res.status} ${res.statusText}`
  try {
    const body = await readJson<unknown>(res)
    return hasError(body) ? body.error : fallback
  } catch {
    // Not JSON.
    return fallback
  }
}
