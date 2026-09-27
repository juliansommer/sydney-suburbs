import { queryOptions } from "@tanstack/react-query"
import { feature, merge } from "topojson-client"
import type { MultiPolygon, Polygon, Topology } from "topojson-specification"
import { z } from "zod/mini"

import type {
  Council,
  Landuse,
  SuburbFeature,
  SuburbMapData,
  Surrounds,
} from "@/types/suburb"

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

const landuseProperties = z.object({
  kind: z.enum(["parkland", "water"]),
})

function layer(topology: Topology, name: string) {
  const object = topology.objects[name]
  if (object?.type !== "GeometryCollection") {
    throw new Error(`TopoJSON has no ${name} layer`)
  }
  return feature(topology, object).features
}

// Merges each council's suburbs, so shared borders drop out of its outline.
function councilOutlines(topology: Topology): Council[] {
  const object = topology.objects.suburbs
  if (object?.type !== "GeometryCollection") {
    return []
  }
  const byLga = new Map<string, (Polygon | MultiPolygon)[]>()
  for (const geometry of object.geometries) {
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const { lga } = suburbProperties.parse(geometry.properties)
      byLga.set(lga, [
        ...(byLga.get(lga) ?? []),
        { ...geometry, properties: {} },
      ])
    }
  }
  return [...byLga].map(([lga, geometries]) => ({
    type: "Feature",
    geometry: merge(topology, geometries),
    properties: { lga },
  }))
}

export function toSuburbMap(topology: Topology): SuburbMapData {
  const suburbs: SuburbFeature[] = []
  for (const f of layer(topology, "suburbs")) {
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
  const [land] = layer(topology, "surrounds")
  if (
    land?.geometry.type !== "Polygon" &&
    land?.geometry.type !== "MultiPolygon"
  ) {
    throw new Error("TopoJSON surrounds layer is empty")
  }
  const surrounds: Surrounds = {
    type: "Feature",
    geometry: land.geometry,
    properties: {},
  }
  const landuse: Landuse[] = []
  for (const f of layer(topology, "landuse")) {
    if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
      landuse.push({
        type: "Feature",
        geometry: f.geometry,
        properties: landuseProperties.parse(f.properties),
      })
    }
  }
  return { suburbs, councils: councilOutlines(topology), surrounds, landuse }
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
    return toSuburbMap(topologySchema.parse(json))
  },
  staleTime: Infinity,
})
