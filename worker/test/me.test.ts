import type { Context } from "hono"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import app from "../index"
import { createTestEnv } from "./d1"

// Better Auth isn't under test: the caller is whoever the header names.
vi.mock("../auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth")>()),
  getSessionUser: async (c: Context) => {
    const id = c.req.header("x-test-user")
    return id ? { id } : null
  },
}))

// Seeded suburbs (ABS SAL codes).
const SUBURB = "10002"
const OTHER_SUBURB = "10003"

let env: Env
let dispose: () => Promise<void>

interface CallOptions {
  user?: string
  body?: unknown
}

async function call(
  method: string,
  path: string,
  { user = "alice", body }: CallOptions = {},
) {
  const headers = new Headers()
  if (user) {
    headers.set("x-test-user", user)
  }
  if (body !== undefined) {
    headers.set("content-type", "application/json")
  }
  return await app.request(
    `/api/me${path}`,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  )
}

async function patch(body: unknown, suburb = SUBURB, user = "alice") {
  return await call("PATCH", `/suburbs/${suburb}`, { body, user })
}

async function list(user = "alice") {
  const res = await call("GET", "/suburbs", { user })
  return await res.json()
}

describe("/api/me/suburbs", () => {
  beforeAll(async () => {
    ;({ env, dispose } = await createTestEnv())
  })

  beforeEach(async () => {
    // Deleting users cascades to their user_suburbs rows.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM user"),
      env.DB.prepare(
        "INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.com'), ('bob', 'Bob', 'bob@example.com')",
      ),
    ])
  })

  afterAll(async () => {
    await dispose()
  })

  it.each([
    ["GET", "/suburbs", undefined],
    ["PATCH", `/suburbs/${SUBURB}`, { visited: true }],
    ["DELETE", `/suburbs/${SUBURB}`, undefined],
  ])("401s %s %s without a user", async (method, path, body) => {
    const res = await call(method, path, { user: "", body })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toStrictEqual({ error: "not signed in" })
  })

  it("lists only the caller's rows", async () => {
    await patch({ visited: true }, SUBURB, "alice")
    await patch({ notes: "someday" }, OTHER_SUBURB, "bob")

    const res = await call("GET", "/suburbs")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toStrictEqual([
      {
        suburbId: SUBURB,
        visited: true,
        visitedOn: null,
        notes: "",
        updatedAt: expect.any(String),
      },
    ])
  })

  it("creates a row", async () => {
    const res = await patch({ visited: true, visitedOn: "2024-03-01" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toStrictEqual({
      suburbId: SUBURB,
      visited: true,
      visitedOn: "2024-03-01",
      notes: "",
      updatedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/),
    })
  })

  it("updates only the fields sent", async () => {
    await patch({ visited: true, visitedOn: "2024-03-01" })

    const notes = await patch({ notes: "great coffee" })
    await expect(notes.json()).resolves.toMatchObject({
      visited: true,
      visitedOn: "2024-03-01",
      notes: "great coffee",
    })

    const visited = await patch({ visitedOn: null })
    await expect(visited.json()).resolves.toMatchObject({
      visited: true,
      visitedOn: null,
      notes: "great coffee",
    })
  })

  it("clears the date when unvisiting", async () => {
    await patch({ visited: true, visitedOn: "2024-03-01", notes: "again" })

    const res = await patch({ visited: false })

    await expect(res.json()).resolves.toMatchObject({
      visited: false,
      visitedOn: null,
      notes: "again",
    })
  })

  it("deletes a row that ends up empty", async () => {
    await patch({ visited: true })

    const res = await patch({ visited: false })

    expect(res.status).toBe(204)
    await expect(list()).resolves.toStrictEqual([])
  })

  it("never creates an empty row", async () => {
    const res = await patch({ notes: "" })

    expect(res.status).toBe(204)
    await expect(list()).resolves.toStrictEqual([])
  })

  it.each([
    ["an empty body", {}],
    ["an unknown key", { visted: true }],
    ["a malformed date", { visitedOn: "2024-13-01" }],
    ["a future date", { visitedOn: "2999-01-01" }],
    ["notes over 10,000 characters", { notes: "x".repeat(10_001) }],
    ["a non-boolean visited", { visited: "yes" }],
  ])("400s on %s", async (_, body) => {
    const res = await patch(body)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toStrictEqual({
      error: expect.any(String),
    })
  })

  it("400s on malformed JSON", async () => {
    const res = await app.request(
      `/api/me/suburbs/${SUBURB}`,
      {
        method: "PATCH",
        headers: { "x-test-user": "alice", "content-type": "application/json" },
        body: "{",
      },
      env,
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toStrictEqual({
      error: expect.any(String),
    })
  })

  it("404s on an unknown suburb", async () => {
    const res = await patch({ visited: true }, "nope")

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toStrictEqual({ error: "unknown suburb" })
  })

  it("deletes a row, and is idempotent", async () => {
    await patch({ visited: true })

    const first = await call("DELETE", `/suburbs/${SUBURB}`)
    const second = await call("DELETE", `/suburbs/${SUBURB}`)

    expect(first.status).toBe(204)
    expect(second.status).toBe(204)
    await expect(list()).resolves.toStrictEqual([])
  })

  it("only deletes the caller's row", async () => {
    await patch({ visited: true }, SUBURB, "bob")

    await call("DELETE", `/suburbs/${SUBURB}`, { user: "alice" })

    await expect(list("bob")).resolves.toHaveLength(1)
  })
})
