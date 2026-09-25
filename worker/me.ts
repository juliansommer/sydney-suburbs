import { zValidator } from "@hono/zod-validator"
import { and, eq, isNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"

import { getSessionUser, type SessionUser } from "./auth"
import { userSuburbs } from "./db/schema"
import { suburbPatchSchema } from "./schemas"

interface MeEnv {
  Bindings: Env
  Variables: { user: SessionUser }
}

type UserSuburbRow = typeof userSuburbs.$inferSelect

export function toApiRow(row: UserSuburbRow) {
  return {
    suburbId: row.suburbId,
    visited: row.visited,
    visitedOn: row.visitedOn,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  }
}

const requireUser = createMiddleware<MeEnv>(async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ error: "not signed in" }, 401)
  }
  c.set("user", user)
  await next()
  return undefined
})

function firstIssue(error: { issues: readonly { message: string }[] }) {
  const [issue] = error.issues
  return issue ? issue.message : "invalid request"
}

// D1 enforces foreign keys, so a suburb id that isn't in `suburbs` fails the
// insert. Drizzle wraps the driver error, so check the causes too.
function isForeignKeyError(error: Error) {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if (e.message.includes("FOREIGN KEY constraint failed")) {
      return true
    }
  }
  return false
}

export const me = new Hono<MeEnv>()
  .use(requireUser)
  .get("/suburbs", async (c) => {
    const rows = await drizzle(c.env.DB)
      .select()
      .from(userSuburbs)
      .where(eq(userSuburbs.userId, c.var.user.id))
    return c.json(rows.map((row) => toApiRow(row)))
  })
  .patch(
    "/suburbs/:id",
    zValidator("json", suburbPatchSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: firstIssue(result.error) }, 400)
      }
      return undefined
    }),
    async (c) => {
      const db = drizzle(c.env.DB)
      const patch = c.req.valid("json")
      const userId = c.var.user.id
      const suburbId = c.req.param("id")
      // Unvisiting drops the date, so a "want to go" row keeps its notes but
      // not a stale visit.
      const visitedOn = patch.visited === false ? null : patch.visitedOn
      const set: Partial<typeof userSuburbs.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (patch.visited !== undefined) {
        set.visited = patch.visited
      }
      if (visitedOn !== undefined) {
        set.visitedOn = visitedOn
      }
      if (patch.notes !== undefined) {
        set.notes = patch.notes
      }
      const row = and(
        eq(userSuburbs.userId, userId),
        eq(userSuburbs.suburbId, suburbId),
      )

      let results
      try {
        results = await db.batch([
          db
            .insert(userSuburbs)
            .values({
              userId,
              suburbId,
              visited: patch.visited ?? false,
              visitedOn: visitedOn ?? null,
              notes: patch.notes ?? "",
            })
            .onConflictDoUpdate({
              target: [userSuburbs.userId, userSuburbs.suburbId],
              set,
            }),
          db
            .delete(userSuburbs)
            .where(
              and(
                row,
                eq(userSuburbs.visited, false),
                eq(userSuburbs.notes, ""),
                isNull(userSuburbs.visitedOn),
              ),
            ),
          db.select().from(userSuburbs).where(row),
        ])
      } catch (error) {
        if (error instanceof Error && isForeignKeyError(error)) {
          return c.json({ error: "unknown suburb" }, 404)
        }
        throw error
      }

      const [_inserted, _deleted, [saved]] = results
      return saved ? c.json(toApiRow(saved)) : c.body(null, 204)
    },
  )
  .delete("/suburbs/:id", async (c) => {
    await drizzle(c.env.DB)
      .delete(userSuburbs)
      .where(
        and(
          eq(userSuburbs.userId, c.var.user.id),
          eq(userSuburbs.suburbId, c.req.param("id")),
        ),
      )
    return c.body(null, 204)
  })
