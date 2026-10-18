import { queryOptions } from "@tanstack/solid-query"
import { z } from "zod/mini"

// Better Auth's endpoints under /api/auth, on the same origin, so the session
// cookie rides along on every request.
const session = z.nullable(z.object({ user: z.object({ email: z.string() }) }))
const redirect = z.object({ url: z.string() })

const SESSION_STALE_MS = 5 * 60 * 1000

export type Session = z.infer<typeof session>

async function post(
  path: string,
  body: Record<string, string>,
): Promise<Response> {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const res = await fetch("/api/auth/get-session")
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`)
    }
    return session.parse(await res.json())
  },
  // Failing fast shows Sign in rather than holding the header back through
  // retries, and the session rarely changes under a tab.
  retry: false,
  staleTime: SESSION_STALE_MS,
})

// Leaves for the provider's sign-in page, which comes back to `callbackURL`.
export async function signInWith(
  provider: "google" | "github",
  callbackURL: string,
) {
  const res = await post("/sign-in/social", { provider, callbackURL })
  const { url } = redirect.parse(await res.json())
  window.location.assign(url)
}

export async function signOut() {
  await post("/sign-out", {})
}
