import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import type { Context } from "hono"

import * as schema from "./db/schema"

// Built per request: bindings arrive with the request on Workers, and the
// instance is cheap to construct.
export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: "sqlite",
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // A signed copy of the session in a short-lived cookie, so most requests
      // skip the D1 session lookup.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

export type SessionUser = Auth["$Infer"]["Session"]["user"]

// The one place requests are matched to a user, kept separate so tests can
// swap it for a header lookup instead of a real Better Auth session.
export async function getSessionUser<E extends { Bindings: Env }>(
  c: Context<E>,
): Promise<SessionUser | null> {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  })
  return session?.user ?? null
}
