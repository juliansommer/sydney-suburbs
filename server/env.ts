import { z } from "zod/mini"

const envSchema = z.object({
  DATABASE_URL: z.string().check(z.minLength(1)),
  BETTER_AUTH_SECRET: z.string().check(z.minLength(1)),
  BETTER_AUTH_URL: z.string().check(z.minLength(1)),
  GOOGLE_CLIENT_ID: z.string().check(z.minLength(1)),
  GOOGLE_CLIENT_SECRET: z.string().check(z.minLength(1)),
})

export type Env = z.infer<typeof envSchema>

let parsed: Env | undefined

// Read on first use rather than at import, so a missing variable fails the
// request that needs it with a clear message instead of crashing the function.
export function getEnv(): Env {
  parsed ??= envSchema.parse(process.env)
  return parsed
}
