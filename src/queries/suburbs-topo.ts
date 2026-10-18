import { queryOptions } from "@tanstack/solid-query"
import type {
  Feature,
  Geometry,
  MultiPolygon as GeoMultiPolygon,
  Polygon as GeoPolygon,
} from "geojson"
import { feature, merge } from "topojson-client"
import type {
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Topology,
} from "topojson-specification"

import { readJson } from "@/lib/json"
import type {
  Council,
  Land,
  Landuse,
  LanduseKind,
  SuburbFeature,
  SuburbMapData,
  SuburbProperties,
  Surrounds,
} from "@/types/suburb"

// The layers scripts/build-suburbs.ts writes.
export type MapTopology = Topology<{
  suburbs: GeometryCollection<SuburbProperties>
  surrounds: GeometryCollection
  landuse: GeometryCollection<{ kind: LanduseKind }>
}>

// Merges the suburbs sharing a key, so shared borders drop out of each
// group's outline. Suburbs with no key are left out.
export function mergeSuburbs(
  topology: MapTopology,
  keyOf: (suburb: SuburbProperties) => string | undefined,
): Map<string, GeoMultiPolygon> {
  const groups = new Map<string, (Polygon | MultiPolygon)[]>()
  for (const geometry of topology.objects.suburbs.geometries) {
    const isArea =
      geometry.type === "Polygon" || geometry.type === "MultiPolygon"
    const key =
      isArea && geometry.properties ? keyOf(geometry.properties) : undefined
    if (!isArea || key === undefined) {
      continue
    }
    const group = groups.get(key)
    const area = { ...geometry, properties: {} }
    if (group) {
      group.push(area)
    } else {
      groups.set(key, [area])
    }
  }
  return new Map(
    [...groups].map(([key, geometries]) => [key, merge(topology, geometries)]),
  )
}

// Whether a feature is an area rather than a stray point or line.
function hasArea<P>(
  f: Feature<Geometry, P>,
): f is Feature<GeoPolygon | GeoMultiPolygon, P> {
  return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
}

function councilOutlines(topology: MapTopology): Council[] {
  return [...mergeSuburbs(topology, (s) => s.lga)].map(([lga, geometry]) => ({
    type: "Feature",
    geometry,
    properties: { lga },
  }))
}

export function toSuburbMap(topology: MapTopology): SuburbMapData {
  const { objects } = topology
  const suburbs: SuburbFeature[] = feature(topology, objects.suburbs)
    .features.filter(hasArea)
    .map((f) => ({
      type: "Feature",
      id: f.properties.id,
      geometry: f.geometry,
      properties: f.properties,
    }))
  const around = feature(topology, objects.surrounds).features.find(hasArea)
  if (!around) {
    throw new Error("TopoJSON surrounds layer is empty")
  }
  const surrounds: Surrounds = {
    type: "Feature",
    geometry: around.geometry,
    properties: {},
  }
  const land: Land = {
    type: "Feature",
    geometry: mergeSuburbs(topology, () => "land").get("land") ?? {
      type: "MultiPolygon",
      coordinates: [],
    },
    properties: {},
  }
  const landuse: Landuse[] = feature(topology, objects.landuse)
    .features.filter(hasArea)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: f.properties,
    }))
  return {
    suburbs,
    councils: councilOutlines(topology),
    surrounds,
    land,
    landuse,
    topology,
  }
}

// The file only changes on deploy, so it never goes stale in a session.
export const suburbsTopoQuery = queryOptions({
  queryKey: ["suburbs-topo"],
  queryFn: async () => {
    const res = await fetch("/sydney-suburbs.topo.json")
    if (!res.ok) {
      throw new Error(`Map data failed to load (${res.status})`)
    }
    return toSuburbMap(await readJson<MapTopology>(res))
  },
  staleTime: Infinity,
})
