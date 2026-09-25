import { queryOptions } from "@tanstack/react-query"
import { z } from "zod/mini"

import { apiFetch } from "@/lib/api"
import { type UserSuburb, userSuburbSchema } from "@/types/user-suburb"

export const mySuburbsKey = ["me", "suburbs"] as const

function bySuburbId(rows: UserSuburb[]) {
  return new Map(rows.map((row) => [row.suburbId, row]))
}

// Signed-in only: pass `enabled: !!session` where it's used.
export const mySuburbsQuery = queryOptions({
  queryKey: mySuburbsKey,
  queryFn: async () =>
    await apiFetch("/api/me/suburbs", z.array(userSuburbSchema)),
  select: bySuburbId,
})
