import { heatmap } from "@/lib/heatmap"
import { once } from "@/lib/load"
import type { HeatmapStat } from "@/lib/stats"

import { getSuburbFacts } from "./suburb-facts"

// One per stat, built from the facts file.
export const getHeatmap = once(async (stat: HeatmapStat) =>
  heatmap(stat, await getSuburbFacts()),
)
