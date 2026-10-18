import { query } from "@solidjs/router"
import { nullable, object, parse, string, type InferOutput } from "valibot"

// Better Auth's endpoints under /api/auth, on the same origin, so the session
// cookie rides along on every request.
const session = nullable(object({ user: object({ email: string() }) }))
const redirect = object({ url: string() })

export type Session = InferOutput<typeof session>

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

// A failed check reads as signed out, so the page shows Sign in rather than
// an error. A live session shows up again on the next load.
export const getSession = query(async (): Promise<Session> => {
  try {
    const res = await fetch("/api/auth/get-session")

    if (!res.ok) {
      return null
    }

    return parse(session, await res.json())
  } catch {
    return null
  }
}, "session")

// Leaves for the provider's sign-in page, which comes back to `callbackURL`.
export async function signInWith(
  provider: "google" | "github",
  callbackURL: string,
) {
  const res = await post("/sign-in/social", { provider, callbackURL })
  const { url } = parse(redirect, await res.json())
  window.location.assign(url)
}

export async function signOut() {
  await post("/sign-out", {})
}
