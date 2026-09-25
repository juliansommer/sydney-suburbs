import { createAuthClient } from "better-auth/react"

// Same origin as the Worker, so the default /api/auth base path is all it
// needs; the session cookie rides along on every request.
export const authClient = createAuthClient()
