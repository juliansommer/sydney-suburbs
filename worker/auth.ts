import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"

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
