import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import type { UserSuburb } from "@/types/user-suburb"

export const mySuburbsKey = ["me", "suburbs"] as const

function bySuburbId(rows: UserSuburb[]) {
  return new Map(rows.map((row) => [row.suburbId, row]))
}

// Signed-in only: pass `enabled: !!session` where it's used.
export const mySuburbsQuery = queryOptions({
  queryKey: mySuburbsKey,
  queryFn: async () => await apiFetch<UserSuburb[]>("/api/me/suburbs"),
  select: bySuburbId,
})
