import { type Accessor, createMemo, createSignal } from "solid-js"

import {
  nextRegionColor,
  nextRegionName,
  type Region,
  REGION_NAME_MAX,
} from "@/lib/regions"

import { useRegionMap } from "./use-region-map"

const NO_SUBURBS: ReadonlySet<string> = new Set()

// The saved regions, plus the suburbs picked for the next one. Clicks go to
// the active region, if one is being edited, and otherwise to the selection.
export function useCustomMap(
  knownIds: Accessor<ReadonlySet<string>>,
  activeId: Accessor<string | undefined>,
) {
  const [map, dispatch] = useRegionMap(knownIds)
  const [selection, setSelection] = createSignal(NO_SUBURBS)
  // Null follows the next unused palette colour.
  const [pickedColor, setPickedColor] = createSignal<string | null>(null)

  const active = createMemo((): Region | undefined =>
    map().regions.find((r) => r.id === activeId()),
  )

  const draftColor = () => pickedColor() ?? nextRegionColor(map())
  const draftName = () => nextRegionName(map())

  function toggle(suburbId: string) {
    const region = active()

    if (region) {
      dispatch({ type: "toggleSuburb", regionId: region.id, suburbId })

      return
    }

    // From the latest value, which a click before the last one drew can
    // still be ahead of.
    setSelection((current) => {
      const next = new Set(current)

      if (!next.delete(suburbId)) {
        next.add(suburbId)
      }

      return next
    })
  }

  function addMany(suburbIds: readonly string[]) {
    const region = active()

    if (region) {
      dispatch({ type: "addSuburbs", regionId: region.id, suburbIds })
    } else {
      setSelection((current) => new Set([...current, ...suburbIds]))
    }
  }

  function clearSelection() {
    setSelection(NO_SUBURBS)
    setPickedColor(null)
  }

  // Names the selection, in the picked colour or the next unused one.
  function createRegion(name: string): string {
    const id = crypto.randomUUID()
    const trimmed = name.trim().slice(0, REGION_NAME_MAX)

    dispatch({
      type: "addRegion",
      region: {
        id,
        name: trimmed || draftName(),
        color: draftColor(),
        suburbIds: [...selection()],
      },
    })
    clearSelection()

    return id
  }

  return {
    map,
    dispatch,
    active,
    selection,
    draftColor,
    draftName,
    setDraftColor: setPickedColor,
    toggle,
    addMany,
    clearSelection,
    createRegion,
  }
}

export type CustomMap = ReturnType<typeof useCustomMap>
