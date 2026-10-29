import {
  array,
  literal,
  maxLength,
  minLength,
  object,
  pipe,
  regex,
  safeParse,
  string,
  trim,
} from "valibot"

export const REGION_NAME_MAX = 40
export const TITLE_MAX = 60
export const DEFAULT_TITLE = "Sydney regions"
export const STORAGE_KEY = "sydney-suburbs:regions"

// Distinct on the light and dark map land, and on white for the export.
export const REGION_PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#469990",
  "#9a6324",
  "#ffe119",
  "#fabed4",
] as const

const HEX_COLOR = /^#[\da-f]{6}$/i

const RegionSchema = object({
  id: string(),
  name: pipe(string(), trim(), minLength(1), maxLength(REGION_NAME_MAX)),
  color: pipe(string(), regex(HEX_COLOR)),
  suburbIds: array(string()),
})

const RegionMapSchema = object({
  version: literal(1),
  title: pipe(string(), maxLength(TITLE_MAX)),
  regions: array(RegionSchema),
})

export interface Region {
  id: string
  name: string
  color: string
  suburbIds: string[]
}

export interface RegionMap {
  version: 1
  // Shown on the export.
  title: string
  // In legend order.
  regions: Region[]
}

export const EMPTY_REGION_MAP: RegionMap = {
  version: 1,
  title: DEFAULT_TITLE,
  regions: [],
}

export type RegionAction =
  | { type: "addRegion"; region: Region }
  | { type: "renameRegion"; id: string; name: string }
  | { type: "recolorRegion"; id: string; color: string }
  | { type: "deleteRegion"; id: string }
  | { type: "moveRegion"; id: string; by: -1 | 1 }
  | { type: "toggleSuburb"; regionId: string; suburbId: string }
  | { type: "addSuburbs"; regionId: string; suburbIds: readonly string[] }
  | { type: "setTitle"; title: string }

function mapRegion(
  map: RegionMap,
  id: string,
  update: (region: Region) => Region,
): RegionMap {
  return {
    ...map,
    regions: map.regions.map((r) => (r.id === id ? update(r) : r)),
  }
}

// A suburb belongs to one region at most, so adding it anywhere takes it out
// of every other region first.
function addTo(
  map: RegionMap,
  regionId: string,
  suburbIds: readonly string[],
): RegionMap {
  const adding = new Set(suburbIds)

  return {
    ...map,
    regions: map.regions.map((r) => {
      const kept = r.suburbIds.filter((id) => !adding.has(id))

      if (r.id !== regionId) {
        return kept.length === r.suburbIds.length
          ? r
          : { ...r, suburbIds: kept }
      }

      return { ...r, suburbIds: [...kept, ...adding] }
    }),
  }
}

function toggleSuburb(
  map: RegionMap,
  regionId: string,
  suburbId: string,
): RegionMap {
  const region = map.regions.find((r) => r.id === regionId)

  if (!region) {
    return map
  }

  if (region.suburbIds.includes(suburbId)) {
    return mapRegion(map, regionId, (r) => ({
      ...r,
      suburbIds: r.suburbIds.filter((id) => id !== suburbId),
    }))
  }

  return addTo(map, regionId, [suburbId])
}

function moveRegion(map: RegionMap, id: string, by: -1 | 1): RegionMap {
  const from = map.regions.findIndex((r) => r.id === id)
  const to = from + by
  const region = map.regions[from]

  if (!region || to < 0 || to >= map.regions.length) {
    return map
  }

  const regions = map.regions.toSpliced(from, 1).toSpliced(to, 0, region)

  return { ...map, regions }
}

export function regionReducer(map: RegionMap, action: RegionAction): RegionMap {
  switch (action.type) {
    case "addRegion": {
      const { region } = action

      const added = {
        ...map,
        regions: [...map.regions, { ...region, suburbIds: [] }],
      }

      return addTo(added, region.id, region.suburbIds)
    }

    case "renameRegion": {
      const name = action.name.trim().slice(0, REGION_NAME_MAX)

      return name ? mapRegion(map, action.id, (r) => ({ ...r, name })) : map
    }

    case "recolorRegion": {
      const valid = HEX_COLOR.test(action.color)

      return valid
        ? mapRegion(map, action.id, (r) => ({ ...r, color: action.color }))
        : map
    }

    case "deleteRegion": {
      return {
        ...map,
        regions: map.regions.filter((r) => r.id !== action.id),
      }
    }

    case "moveRegion": {
      return moveRegion(map, action.id, action.by)
    }

    case "toggleSuburb": {
      return toggleSuburb(map, action.regionId, action.suburbId)
    }

    case "addSuburbs": {
      const exists = map.regions.some((r) => r.id === action.regionId)

      return exists ? addTo(map, action.regionId, action.suburbIds) : map
    }

    case "setTitle": {
      return { ...map, title: action.title.slice(0, TITLE_MAX) }
    }

    default: {
      return map
    }
  }
}

// "Region N" for the first N not taken.
export function nextRegionName(map: RegionMap): string {
  const names = new Set(map.regions.map((r) => r.name))
  let n = map.regions.length + 1

  while (names.has(`Region ${n}`)) {
    n += 1
  }

  return `Region ${n}`
}

// The first palette colour not already used, cycling once they all are.
export function nextRegionColor(map: RegionMap): string {
  const used = new Set(map.regions.map((r) => r.color.toLowerCase()))

  return (
    REGION_PALETTE.find((c) => !used.has(c)) ??
    REGION_PALETTE[map.regions.length % REGION_PALETTE.length] ??
    REGION_PALETTE[0]
  )
}

export function regionBySuburb(map: RegionMap): Map<string, Region> {
  return new Map(
    map.regions.flatMap((r) => r.suburbIds.map((id) => [id, r] as const)),
  )
}

// Missing, corrupt or outdated data starts an empty map, and suburbs the map
// no longer draws are dropped.
export function parseRegionMap(
  raw: string | null,
  knownIds: ReadonlySet<string>,
): RegionMap {
  if (raw === null) {
    return EMPTY_REGION_MAP
  }

  let json: unknown

  try {
    json = JSON.parse(raw)
  } catch {
    return EMPTY_REGION_MAP
  }

  const result = safeParse(RegionMapSchema, json)

  if (!result.success) {
    return EMPTY_REGION_MAP
  }

  const seen = new Set<string>()

  // Keeps the first region a suburb is in, should two claim it.
  const regions = result.output.regions.map((r) => {
    const suburbIds = r.suburbIds.filter((id) => {
      const keep = knownIds.has(id) && !seen.has(id)
      seen.add(id)

      return keep
    })

    return { ...r, suburbIds }
  })

  return { ...result.output, regions }
}
