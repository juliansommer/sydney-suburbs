// Secrets come from .env locally and `wrangler secret put` in production, so
// `wrangler types` cannot see them in wrangler.jsonc. Merged into the global
// Env it generates.
interface Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}
