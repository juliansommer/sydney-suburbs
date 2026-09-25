import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import { createAuth } from "./auth"

interface AppEnv {
  Bindings: Env
}

// Only /api/* reaches this Worker (run_worker_first in wrangler.jsonc); static
// assets and their headers are handled by public/_headers.
const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(secureHeaders())
  .use(async (c, next) => {
    await next()
    // Set on c.res so it also covers Better Auth's raw Response.
    c.res.headers.set("Cache-Control", "no-store")
  })
  .on(
    ["GET", "POST"],
    "/auth/*",
    async (c) => await createAuth(c.env).handler(c.req.raw),
  )
  .get("/healthz", async (c) => {
    await c.env.DB.prepare("SELECT 1").first()
    return c.json({ ok: true })
  })

// Unknown /api paths 404 as JSON: a fetch that got index.html instead would
// fail at the parse, far from the actual mistake.
app.notFound((c) => c.json({ error: "not found" }, 404))

export default app satisfies ExportedHandler<Env>
