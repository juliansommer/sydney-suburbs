import { query } from "@solidjs/router"

import { heatmap } from "@/lib/heatmap"
import type { HeatmapStat } from "@/lib/stats"

import { getSuburbFacts } from "./suburb-facts"

// One per stat, built from the facts file.
export const getHeatmap = query(
  async (stat: HeatmapStat) => heatmap(stat, await getSuburbFacts()),
  "heatmap",
)
