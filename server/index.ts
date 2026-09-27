import { sql } from "drizzle-orm"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { secureHeaders } from "hono/secure-headers"

import { getAuth } from "./auth.js"
import { getDb } from "./db/client.js"
import { me } from "./me.js"

// Only /api/* reaches this app (see vercel.json); static assets and their
// headers are served by Vercel directly.
const app = new Hono()
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
    async (c) => await getAuth().handler(c.req.raw),
  )
  .get("/healthz", async (c) => {
    await getDb().execute(sql`SELECT 1`)
    return c.json({ ok: true })
  })
  .route("/me", me)

// Unknown /api paths 404 as JSON: a fetch that got index.html instead would
// fail at the parse, far from the actual mistake.
app.notFound((c) => c.json({ error: "not found" }, 404))

// Hono's own errors (a malformed JSON body, say) are plain text by default.
app.onError((thrown, c) => {
  if (thrown instanceof HTTPException) {
    return c.json({ error: thrown.message }, thrown.status)
  }
  throw thrown
})

export default app
