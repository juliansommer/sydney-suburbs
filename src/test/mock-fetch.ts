import { vi } from "vitest"

import { applyPatch } from "@/mutations/use-update-suburb"
import type { UserSuburb, UserSuburbPatch } from "@/types/user-suburb"

import { suburbsTopology } from "./fixtures"

interface MockFetchOptions {
  // The signed-in user's rows. PATCHes update them, as the Worker would.
  suburbs?: UserSuburb[]
  // Overrides the PATCH response, e.g. to hold it open or fail it.
  onPatch?: (id: string, patch: UserSuburbPatch) => Promise<Response> | Response
}

// Stubs `fetch` with the map file and a stateful /api/me/suburbs. Returns the
// PATCHes it has seen as [path, body] pairs.
export function mockFetch({ suburbs = [], onPatch }: MockFetchOptions = {}) {
  let rows = suburbs
  const patches: [string, UserSuburbPatch][] = []

  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const request = new Request(new URL(input, "http://localhost"), init)
    const { pathname } = new URL(request.url)

    if (pathname === "/sydney-suburbs.topo.json") {
      return Response.json(suburbsTopology)
    }
    if (pathname === "/api/me/suburbs" && request.method === "GET") {
      return Response.json(rows)
    }
    const id = /^\/api\/me\/suburbs\/(?<id>[^/]+)$/.exec(pathname)?.groups?.id
    if (id && request.method === "PATCH") {
      const patch = (await request.json()) as UserSuburbPatch
      patches.push([pathname, patch])
      if (onPatch) {
        return await onPatch(id, patch)
      }
      rows = applyPatch(rows, id, patch)
      const row = rows.find((r) => r.suburbId === id)
      return row ? Response.json(row) : new Response(null, { status: 204 })
    }
    return Response.json({ error: "not found" }, { status: 404 })
  })
  vi.stubGlobal("fetch", fetch)
  return { patches }
}
