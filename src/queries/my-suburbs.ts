import { query } from "@solidjs/router"
import {
  type Accessor,
  createContext,
  createOptimisticStore,
  useContext,
} from "solid-js"
import { z } from "zod/mini"

import { apiFetch } from "@/lib/api"
import { retry } from "@/lib/load"
import { type UserSuburb, userSuburbSchema } from "@/types/user-suburb"

export const getMySuburbs = query(
  async () =>
    await retry(
      async () => await apiFetch("/api/me/suburbs", z.array(userSuburbSchema)),
    ),
  "my-suburbs",
)

// The user's rows, empty when signed out. Saves write to it optimistically,
// and the write reverts once the save settles and the rows refetch.
export function createMySuburbs(signedIn: Accessor<boolean>) {
  return createOptimisticStore<UserSuburb[]>(
    (): Promise<UserSuburb[]> | UserSuburb[] =>
      signedIn() ? getMySuburbs() : [],
    [],
    { key: "suburbId" },
  )
}

export type MySuburbs = ReturnType<typeof createMySuburbs>

export const MySuburbsContext = createContext<MySuburbs>()

export function useMySuburbs(): MySuburbs {
  return useContext(MySuburbsContext)
}
