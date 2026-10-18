import { queryOptions } from "@tanstack/solid-query"

import { heatmap } from "@/lib/heatmap"
import type { HeatmapStat } from "@/lib/stats"

import { suburbFactsQuery } from "./suburb-facts"

// One per stat, built from the facts file, which never changes.
export function heatmapQuery(stat: HeatmapStat) {
  return queryOptions({
    queryKey: ["heatmap", stat],
    queryFn: async ({ client }) =>
      heatmap(stat, await client.fetchQuery(suburbFactsQuery)),
    staleTime: Infinity,
  })
}
