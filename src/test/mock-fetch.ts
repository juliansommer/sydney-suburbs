import { vi } from "vitest"

import { applyPatch } from "@/mutations/use-update-suburb"
import type { SuburbFactsFile } from "@/types/suburb-facts"
import type { UserSuburb, UserSuburbPatch } from "@/types/user-suburb"

import { suburbFacts, suburbsTopology } from "./fixtures"

interface MockFetchOptions {
  // The signed-in user's rows. PATCHes update them, as the Worker would.
  suburbs?: UserSuburb[]
  // Overrides the PATCH response, e.g. to hold it open or fail it.
  onPatch?: (id: string, patch: UserSuburbPatch) => Promise<Response> | Response
  // The suburb facts file, or a response to send instead, e.g. to fail it or
  // hold it open.
  facts?: SuburbFactsFile | Response | Promise<Response>
}

// Vite serves the facts file under a hashed name in production and its
// source path in tests, so match on the filename.
export function isFactsRequest(input: string) {
  return input.endsWith("suburb-facts.json")
}

// Stubs `fetch` with the map file, the facts file and a stateful
// /api/me/suburbs. Returns the PATCHes it has seen as [path, body] pairs.
export function mockFetch({
  suburbs = [],
  onPatch,
  facts = suburbFacts,
}: MockFetchOptions = {}) {
  let rows = suburbs
  const patches: [string, UserSuburbPatch][] = []

  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const request = new Request(new URL(input, "http://localhost"), init)
    const { pathname } = new URL(request.url)

    if (pathname === "/sydney-suburbs.topo.json") {
      return Response.json(suburbsTopology)
    }
    if (isFactsRequest(pathname)) {
      return facts instanceof Response || facts instanceof Promise
        ? await facts
        : Response.json(facts)
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
