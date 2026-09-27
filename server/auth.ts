import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import type { Context } from "hono"

import { getDb } from "./db/client.js"
import * as schema from "./db/schema.js"
import { getEnv } from "./env.js"

function createAuth() {
  const env = getEnv()
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // A signed copy of the session in a short-lived cookie, so most requests
      // skip the database session lookup.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

export type SessionUser = Auth["$Infer"]["Session"]["user"]

let auth: Auth | undefined

export function getAuth(): Auth {
  auth ??= createAuth()
  return auth
}

// The one place requests are matched to a user, kept separate so tests can
// swap it for a header lookup instead of a real Better Auth session.
export async function getSessionUser(c: Context): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({
    headers: c.req.raw.headers,
  })
  return session?.user ?? null
}
