import { vi } from "vitest"

import { authClient } from "@/lib/auth-client"

// Tests that use these must also vi.mock("@/lib/auth-client").
function setSession(data: { user: { email: string } } | null) {
  vi.mocked(authClient.useSession).mockReturnValue({
    data,
    isPending: false,
  } as ReturnType<typeof authClient.useSession>)
}

export function signIn() {
  setSession({ user: { email: "someone@example.com" } })
}

export function signOut() {
  setSession(null)
}
