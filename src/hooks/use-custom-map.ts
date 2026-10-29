import { type Accessor, createMemo } from "solid-js"

import {
  nextRegionColor,
  nextRegionName,
  type Region,
  type RegionAction,
} from "@/lib/regions"

import { useRegionMap } from "./use-region-map"

// The saved regions, and the one clicks add suburbs to: the one picked, or
// the newest. With none yet, the first click starts one.
export function useCustomMap(
  knownIds: Accessor<ReadonlySet<string>>,
  activeId: Accessor<string | undefined>,
  setActiveId: (id: string) => void,
) {
  const [map, dispatchMap] = useRegionMap(knownIds)
  // A click straight after the first can come before the new region draws,
  // so it goes to the region just made rather than starting another.
  let created: string | undefined

  function dispatch(action: RegionAction) {
    if (action.type === "deleteRegion" && action.id === created) {
      created = undefined
    }

    dispatchMap(action)
  }

  const active = createMemo(
    (): Region | undefined =>
      map().regions.find((r) => r.id === activeId()) ?? map().regions.at(-1),
  )

  // Named "Region N" in the next unused colour, and made the active one.
  function addRegion(): string {
    const id = crypto.randomUUID()

    dispatch({
      type: "addRegion",
      region: {
        id,
        name: nextRegionName(map()),
        color: nextRegionColor(map()),
        suburbIds: [],
      },
    })
    setActiveId(id)
    created = id

    return id
  }

  function toggle(suburbId: string) {
    const regionId = active()?.id ?? created ?? addRegion()

    dispatch({ type: "toggleSuburb", regionId, suburbId })
  }

  function addMany(suburbIds: readonly string[]) {
    const regionId = active()?.id ?? created ?? addRegion()

    dispatch({ type: "addSuburbs", regionId, suburbIds })
  }

  return { map, dispatch, active, addRegion, toggle, addMany }
}

export type CustomMap = ReturnType<typeof useCustomMap>
