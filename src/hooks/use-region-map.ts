import { type Accessor, createSignal, onSettled } from "solid-js"

import {
  parseRegionMap,
  type RegionAction,
  type RegionMap,
  regionReducer,
  STORAGE_KEY,
} from "@/lib/regions"

function read(knownIds: ReadonlySet<string>): RegionMap {
  try {
    return parseRegionMap(localStorage.getItem(STORAGE_KEY), knownIds)
  } catch {
    // Storage can be blocked outright, e.g. by privacy settings.
    return parseRegionMap(null, knownIds)
  }
}

function write(map: RegionMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Full or blocked storage keeps the map for this visit only.
  }
}

// The custom map, kept in localStorage so it works signed out. Another tab's
// changes show here too; whichever tab writes last wins.
export function useRegionMap(knownIds: Accessor<ReadonlySet<string>>) {
  // Derived, so it reads storage once the suburbs it checks against load.
  const [map, setMap] = createSignal<RegionMap>(() => read(knownIds()))

  // From the latest value, which a change before the last one drew can still
  // be ahead of.
  function dispatch(action: RegionAction) {
    setMap((current) => {
      const next = regionReducer(current, action)

      if (next !== current) {
        write(next)
      }

      return next
    })
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      setMap(parseRegionMap(event.newValue, knownIds()))
    }
  }

  onSettled(() => {
    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener("storage", onStorage)
    }
  })

  return [map, dispatch] as const
}
