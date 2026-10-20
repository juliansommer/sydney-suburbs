import { HEATMAP_BREAKS, type HeatmapStat } from "@/lib/stats"
import type { MapLayers } from "@/types/map-layers"
import type { SuburbFactsFile } from "@/types/suburb-facts"

interface HeatLevel {
  fill: string
  swatch: string
}

// Literal class names, white to red, so Tailwind generates them.
const RED_LEVELS: readonly HeatLevel[] = [
  { fill: "fill-heat-1", swatch: "bg-heat-1" },
  { fill: "fill-heat-2", swatch: "bg-heat-2" },
  { fill: "fill-heat-3", swatch: "bg-heat-3" },
  { fill: "fill-heat-4", swatch: "bg-heat-4" },
  { fill: "fill-heat-5", swatch: "bg-heat-5" },
  { fill: "fill-heat-6", swatch: "bg-heat-6" },
  { fill: "fill-heat-7", swatch: "bg-heat-7" },
  { fill: "fill-heat-8", swatch: "bg-heat-8" },
]

// White to green, for stats where more is greener.
const GREEN_LEVELS: readonly HeatLevel[] = [
  { fill: "fill-canopy-1", swatch: "bg-canopy-1" },
  { fill: "fill-canopy-2", swatch: "bg-canopy-2" },
  { fill: "fill-canopy-3", swatch: "bg-canopy-3" },
  { fill: "fill-canopy-4", swatch: "bg-canopy-4" },
  { fill: "fill-canopy-5", swatch: "bg-canopy-5" },
  { fill: "fill-canopy-6", swatch: "bg-canopy-6" },
  { fill: "fill-canopy-7", swatch: "bg-canopy-7" },
  { fill: "fill-canopy-8", swatch: "bg-canopy-8" },
]

const PALETTES: Partial<Record<HeatmapStat, readonly HeatLevel[]>> = {
  treeCanopy: GREEN_LEVELS,
}

export const NO_DATA: HeatLevel = {
  fill: "fill-heat-none",
  swatch: "bg-heat-none",
}

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

// Spreads however many buckets there are across the palette's full range.
function levelFor(
  bucket: number,
  count: number,
  levels: readonly HeatLevel[],
): HeatLevel {
  const top = levels.length - 1
  const index = count > 1 ? Math.round((bucket * top) / (count - 1)) : top

  return levels[index] ?? NO_DATA
}

// Fills each suburb by its bucket for `stat`, and suburbs with no figure in
// grey. The facts file covers every suburb on the map.
export function heatmap(stat: HeatmapStat, facts: SuburbFactsFile): Heatmap {
  const breaks = HEATMAP_BREAKS[stat]
  const count = breaks.length + 1
  const members = Array.from({ length: count }, () => new Set<string>())
  const noData = new Set<string>()

  for (const [id, { stats }] of Object.entries(facts)) {
    const value = stats[stat]

    if (value === null || value === undefined) {
      noData.add(id)
    } else {
      members[bucketOf(value, breaks)]?.add(id)
    }
  }

  const palette = PALETTES[stat] ?? RED_LEVELS
  const levels = members.map((_, i) => levelFor(i, count, palette))

  return {
    layers: {
      fills: [
        { key: "heat-none", ids: noData, className: NO_DATA.fill },
        ...members.map((bucket, i) => ({
          key: `heat-${i}`,
          ids: bucket,
          className: levels[i]?.fill ?? NO_DATA.fill,
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
