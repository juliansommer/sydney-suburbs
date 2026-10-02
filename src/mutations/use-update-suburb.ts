import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod/mini"

import { apiFetch } from "@/lib/api"
import { mySuburbsKey } from "@/queries/my-suburbs"
import {
  type UserSuburb,
  type UserSuburbPatch,
  userSuburbSchema,
} from "@/types/user-suburb"

// Mirrors the Worker: unvisiting drops the date, and a row left with nothing in
// it goes away.
export function applyPatch(
  rows: UserSuburb[],
  suburbId: string,
  patch: UserSuburbPatch,
): UserSuburb[] {
  const others = rows.filter((row) => row.suburbId !== suburbId)
  const current = rows.find((row) => row.suburbId === suburbId) ?? {
    suburbId,
    visited: false,
    visitedOn: null,
    notes: "",
    updatedAt: new Date().toISOString(),
  }
  const next = { ...current, ...patch }
  if (patch.visited === false) {
    next.visitedOn = null
  }
  const empty = !next.visited && next.visitedOn === null && next.notes === ""
  return empty ? others : [...others, next]
}

// Every change to one suburb goes through here. The shared scope runs them in
// order, so a notes save can't overtake the toggle before it.
export function useUpdateSuburb(suburbId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [...mySuburbsKey, suburbId],
    scope: { id: `me/suburbs/${suburbId}` },
    mutationFn: async (patch: UserSuburbPatch) =>
      await apiFetch(
        `/api/me/suburbs/${encodeURIComponent(suburbId)}`,
        z.nullable(userSuburbSchema),
        {
          method: "PATCH",
          body: JSON.stringify(patch),
          // The page may be going away, so let the request outlive it.
          keepalive: document.visibilityState === "hidden",
        },
      ),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: mySuburbsKey })
      const previous = queryClient.getQueryData<UserSuburb[]>(mySuburbsKey)
      if (previous) {
        queryClient.setQueryData(
          mySuburbsKey,
          applyPatch(previous, suburbId, patch),
        )
      }
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(mySuburbsKey, context.previous)
      }
    },
    onSettled: async () => {
      // Refetching while another save is in flight would briefly undo its
      // optimistic change, so only the last one to finish refetches.
      if (queryClient.isMutating({ mutationKey: mySuburbsKey }) === 1) {
        await queryClient.invalidateQueries({ queryKey: mySuburbsKey })
      }
    },
  })
}
