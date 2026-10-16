import { queryOptions } from "@tanstack/react-query"

import { heatmap } from "@/lib/heatmap"
import type { HeatmapStat } from "@/lib/stats"

import { suburbFactsQuery } from "./suburb-facts"
import { suburbsTopoQuery } from "./suburbs-topo"

// One per stat, built from the facts and map files, which never change.
export function heatmapQuery(stat: HeatmapStat) {
  return queryOptions({
    queryKey: ["heatmap", stat],
    queryFn: async ({ client }) => {
      const [facts, data] = await Promise.all([
        client.query(suburbFactsQuery),
        client.query(suburbsTopoQuery),
      ])
      return heatmap(
        stat,
        facts,
        data.suburbs.map((s) => s.properties.id),
      )
    },
    staleTime: Infinity,
  })
}
