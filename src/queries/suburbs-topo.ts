import { queryOptions } from "@tanstack/react-query"
import { feature } from "topojson-client"
import type { Topology } from "topojson-specification"
import { z } from "zod/mini"

import type { SuburbFeature } from "@/types/suburb"

const topologyHeader = z.object({
  type: z.literal("Topology"),
  objects: z.record(z.string(), z.unknown()),
})
const topologySchema = z.custom<Topology>(
  (value) => topologyHeader.safeParse(value).success,
)

const suburbProperties = z.object({
  id: z.string(),
  name: z.string(),
  lga: z.string(),
  lx: z.number(),
  ly: z.number(),
})

export function toSuburbFeatures(topology: Topology): SuburbFeature[] {
  const layer = topology.objects.suburbs
  if (layer?.type !== "GeometryCollection") {
    throw new Error("TopoJSON has no suburbs layer")
  }
  const suburbs: SuburbFeature[] = []
  for (const f of feature(topology, layer).features) {
    if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
      const properties = suburbProperties.parse(f.properties)
      suburbs.push({
        type: "Feature",
        id: properties.id,
        geometry: f.geometry,
        properties,
      })
    }
  }
  return suburbs
}

// The file only changes on deploy, so it never goes stale in a session.
export const suburbsTopoQuery = queryOptions({
  queryKey: ["suburbs-topo"],
  queryFn: async () => {
    const res = await fetch("/sydney-suburbs.topo.json")
    if (!res.ok) {
      throw new Error(`Map data failed to load (${res.status})`)
    }
    const json: unknown = await res.json()
    return toSuburbFeatures(topologySchema.parse(json))
  },
  staleTime: Infinity,
})
