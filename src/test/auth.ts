import type { Session } from "@/lib/auth"

// What the mocked /api/auth/get-session returns. Signed out unless a test
// signs in.
let session: Session = null

export function currentSession(): Session {
  return session
}

export function signIn() {
  session = { user: { email: "someone@example.com" } }
}

export function signOut() {
  session = null
}
