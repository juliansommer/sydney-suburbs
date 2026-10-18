import {
  minLength,
  object,
  parse,
  pipe,
  string,
  type InferOutput,
} from "valibot"

const envSchema = object({
  DATABASE_URL: pipe(string(), minLength(1)),
  BETTER_AUTH_SECRET: pipe(string(), minLength(1)),
  BETTER_AUTH_URL: pipe(string(), minLength(1)),
  GOOGLE_CLIENT_ID: pipe(string(), minLength(1)),
  GOOGLE_CLIENT_SECRET: pipe(string(), minLength(1)),
  GITHUB_CLIENT_ID: pipe(string(), minLength(1)),
  GITHUB_CLIENT_SECRET: pipe(string(), minLength(1)),
})

export type Env = InferOutput<typeof envSchema>

let parsed: Env | undefined

// Read on first use rather than at import, so a missing variable fails the
// request that needs it with a clear message instead of crashing the function.
export function getEnv(): Env {
  parsed ??= parse(envSchema, process.env)

  return parsed
}
