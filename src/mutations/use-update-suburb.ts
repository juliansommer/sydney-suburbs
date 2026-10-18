import { revalidate } from "@solidjs/router"
import { action, createOptimistic, createSignal } from "solid-js"
import { nullable } from "valibot"

import { apiFetch } from "@/lib/api"
import { getMySuburbs, useMySuburbs } from "@/queries/my-suburbs"
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

let lastSave: Promise<void> = Promise.resolve()

// Saves go out one at a time, so a later change can't land before an earlier
// one, like a notes save overtaking the toggle before it.
async function save(suburbId: string, patch: UserSuburbPatch): Promise<void> {
  const previous = lastSave
  lastSave = (async () => {
    try {
      await previous
    } catch {
      // Its own caller handles a failed save; this one goes out regardless.
    }
    await apiFetch(
      `/api/me/suburbs/${encodeURIComponent(suburbId)}`,
      nullable(userSuburbSchema),
      {
        method: "PATCH",
        body: JSON.stringify(patch),
        // The page may be going away, so let the request outlive it.
        keepalive: document.visibilityState === "hidden",
      },
    )
  })()
  await lastSave
}

type SaveStatus = "idle" | "saved" | "failed"

// Every change to one suburb goes through here. The change shows at once, and
// reverts if the save fails.
export function useUpdateSuburb(suburbId: string) {
  const [, setRows] = useMySuburbs()
  const [saving, setSaving] = createOptimistic(false)
  const [status, setStatus] = createSignal<SaveStatus>("idle")

  const mutate = action(function* update(patch: UserSuburbPatch) {
    setSaving(true)
    setRows((rows) => applyPatch(rows, suburbId, patch))
    try {
      yield save(suburbId, patch)
      setStatus("saved")
    } catch {
      setStatus("failed")
    }
    // The refetch lands with the end of the save, so the rows never flash
    // back to how they were first.
    revalidate(getMySuburbs.key)
  })

  return {
    mutate,
    get isPending() {
      return saving()
    },
    get isSuccess() {
      return status() === "saved"
    },
    get isError() {
      return status() === "failed"
    },
  }
}
