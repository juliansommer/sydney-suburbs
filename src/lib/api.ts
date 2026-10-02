import { z } from "zod/mini"

const errorBody = z.object({ error: z.string() })

// Fetches JSON from our API and parses it with `schema`. A 204 parses as
// null, so pass a nullable schema for routes that can return one. A 401 means
// the session is gone, so it sends the user to sign in and back here after.
export async function apiFetch<T>(
  path: string,
  schema: z.ZodMiniType<T>,
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
    throw new Error(await errorMessage(res))
  }
  const body: unknown = res.status === 204 ? null : await res.json()
  return schema.parse(body)
}

async function errorMessage(res: Response) {
  const fallback = `${res.status} ${res.statusText}`
  try {
    return errorBody.safeParse(await res.json()).data?.error ?? fallback
  } catch {
    // Not JSON.
    return fallback
  }
}
