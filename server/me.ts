import { zValidator } from "@hono/zod-validator"
import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"

import { getSessionUser, type SessionUser } from "./auth.js"
import { getDb } from "./db/client.js"
import { userSuburbs } from "./db/schema.js"
import { suburbPatchSchema } from "./schemas.js"

interface MeEnv {
  Variables: { user: SessionUser }
}

// The columns the API returns. c.json sends updatedAt as an ISO string.
const apiColumns = {
  suburbId: userSuburbs.suburbId,
  visited: userSuburbs.visited,
  visitedOn: userSuburbs.visitedOn,
  notes: userSuburbs.notes,
  updatedAt: userSuburbs.updatedAt,
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

const FOREIGN_KEY_VIOLATION = "23503"

// A suburb id that isn't in `suburbs` fails the insert. Drizzle wraps the
// driver error, so check the causes for Postgres's error code.
function isForeignKeyError(error: Error) {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ("code" in e && e.code === FOREIGN_KEY_VIOLATION) {
      return true
    }
  }
  return false
}

export const me = new Hono<MeEnv>()
  .use(requireUser)
  .get("/suburbs", async (c) => {
    const rows = await getDb()
      .select(apiColumns)
      .from(userSuburbs)
      .where(eq(userSuburbs.userId, c.var.user.id))
    return c.json(rows)
  })
  .patch(
    "/suburbs/:id",
    zValidator("json", suburbPatchSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: result.error.issues[0]?.message ?? "invalid request" },
          400,
        )
      }
      return undefined
    }),
    async (c) => {
      const db = getDb()
      const patch = c.req.valid("json")
      const userId = c.var.user.id
      const suburbId = c.req.param("id")
      // Unvisiting drops the date, so a "want to go" row keeps its notes but
      // not a stale visit.
      const visitedOn = patch.visited === false ? null : patch.visitedOn

      let saved
      try {
        ;[saved] = await db
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
            // Drizzle skips undefined keys, so only sent fields change.
            set: { ...patch, visitedOn, updatedAt: new Date() },
          })
          .returning(apiColumns)
      } catch (error) {
        if (error instanceof Error && isForeignKeyError(error)) {
          return c.json({ error: "unknown suburb" }, 404)
        }
        throw error
      }

      const isEmpty =
        !saved || (!saved.visited && saved.notes === "" && !saved.visitedOn)
      if (!isEmpty) {
        return c.json(saved)
      }
      // The conditions repeat the check so a concurrent edit that filled the
      // row in since isn't lost.
      await db
        .delete(userSuburbs)
        .where(
          and(
            eq(userSuburbs.userId, userId),
            eq(userSuburbs.suburbId, suburbId),
            eq(userSuburbs.visited, false),
            eq(userSuburbs.notes, ""),
            isNull(userSuburbs.visitedOn),
          ),
        )
      return c.body(null, 204)
    },
  )
