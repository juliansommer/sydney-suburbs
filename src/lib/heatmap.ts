import { HEATMAP_BREAKS, type HeatmapStat } from "@/lib/stats"
import type { MapLayers } from "@/types/map-layers"
import type { SuburbFactsFile } from "@/types/suburb-facts"

// Literal class names, white to red, so Tailwind generates them.
export const HEAT_LEVELS = [
  { fill: "fill-heat-1", swatch: "bg-heat-1" },
  { fill: "fill-heat-2", swatch: "bg-heat-2" },
  { fill: "fill-heat-3", swatch: "bg-heat-3" },
  { fill: "fill-heat-4", swatch: "bg-heat-4" },
  { fill: "fill-heat-5", swatch: "bg-heat-5" },
  { fill: "fill-heat-6", swatch: "bg-heat-6" },
  { fill: "fill-heat-7", swatch: "bg-heat-7" },
] as const
export const NO_DATA = { fill: "fill-heat-none", swatch: "bg-heat-none" }
const HOTTEST = HEAT_LEVELS.at(-1) ?? HEAT_LEVELS[0]

export interface HeatBucket {
  // Null for the open-ended lowest and highest buckets.
  from: number | null
  to: number | null
  swatch: string
}

export interface Heatmap {
  layers: MapLayers
  // Lowest values first.
  buckets: HeatBucket[]
  hasNoData: boolean
}

// The number of edges at or below `value`, so a value on an edge goes up.
export function bucketOf(value: number, breaks: readonly number[]): number {
  return breaks.filter((edge) => value >= edge).length
}

// Spreads however many buckets there are across the full white-to-red range.
function levelFor(bucket: number, count: number) {
  const top = HEAT_LEVELS.length - 1
  const index = count > 1 ? Math.round((bucket * top) / (count - 1)) : top
  return HEAT_LEVELS[index] ?? HOTTEST
}

// Fills each suburb by its bucket for `stat`, and suburbs with no figure in
// grey. `ids` are the suburbs on the map.
export function heatmap(
  stat: HeatmapStat,
  facts: SuburbFactsFile,
  ids: string[],
): Heatmap {
  const breaks = HEATMAP_BREAKS[stat]
  const count = breaks.length + 1
  const members = Array.from({ length: count }, () => new Set<string>())
  const noData = new Set<string>()
  for (const id of ids) {
    const value = facts[id]?.stats[stat]
    if (value === null || value === undefined) {
      noData.add(id)
    } else {
      members[bucketOf(value, breaks)]?.add(id)
    }
  }
  const levels = members.map((_, i) => levelFor(i, count))

  return {
    layers: {
      fills: [
        { key: "heat-none", ids: noData, className: NO_DATA.fill },
        ...members.map((bucket, i) => ({
          key: `heat-${i}`,
          ids: bucket,
          className: levels[i]?.fill ?? HOTTEST.fill,
        })),
      ],
      outlines: [],
      markers: [],
    },
    buckets: levels.map((level, i) => ({
      from: breaks[i - 1] ?? null,
      to: breaks[i] ?? null,
      swatch: level.swatch,
    })),
    hasNoData: noData.size > 0,
  }
}
