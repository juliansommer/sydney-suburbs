import { geoArea } from "d3-geo"
import type { MultiPolygon, Polygon, Position } from "geojson"
import polylabel from "polylabel"
import { merge } from "topojson-client"
import type {
  MultiPolygon as TopoMultiPolygon,
  Polygon as TopoPolygon,
} from "topojson-specification"

import type { MapTopology } from "@/queries/suburbs-topo"
import type { MapLabel, MapLayers } from "@/types/map-layers"
import type { SuburbMapData } from "@/types/suburb"

import type { RegionMap } from "./regions"

// In degrees, about 50 m: far finer than a label needs.
const LABEL_PRECISION = 0.0005

// Shapes are kept per set of suburbs, so a rename or recolour merges nothing
// and a click merges only the region it changed.
const MAX_CACHED_AREAS = 200

interface RegionArea {
  geometry: MultiPolygon
  // Where the name goes, and the box it has room in, in lon/lat.
  label?: Pick<MapLabel, "coords" | "bounds">
}

type SuburbGeometry = TopoPolygon | TopoMultiPolygon

const geometriesByTopology = new WeakMap<
  MapTopology,
  Map<string, SuburbGeometry>
>()

const areaCache = new Map<string, RegionArea>()

function suburbGeometries(topology: MapTopology): Map<string, SuburbGeometry> {
  const cached = geometriesByTopology.get(topology)

  if (cached) {
    return cached
  }

  const byId = new Map<string, SuburbGeometry>()

  for (const g of topology.objects.suburbs.geometries) {
    const isArea = g.type === "Polygon" || g.type === "MultiPolygon"

    if (isArea && g.properties) {
      byId.set(g.properties.id, { ...g, properties: {} })
    }
  }

  geometriesByTopology.set(topology, byId)

  return byId
}

function largestPolygon(geometry: MultiPolygon): Polygon | undefined {
  const polygons = geometry.coordinates.map((rings): Polygon => ({
    type: "Polygon",
    coordinates: rings,
  }))

  return polygons.toSorted((a, b) => geoArea(b) - geoArea(a))[0]
}

function ringBounds(ring: Position[]): MapLabel["bounds"] {
  const lons = ring.map(([lon]) => lon ?? 0)
  const lats = ring.map(([, lat]) => lat ?? 0)

  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

// At the pole of inaccessibility of the largest piece, so the name sits
// inside the area rather than in a bay.
function labelFor(geometry: MultiPolygon): RegionArea["label"] {
  const polygon = largestPolygon(geometry)
  const outer = polygon?.coordinates[0]

  if (!polygon || !outer) {
    return undefined
  }

  const rings = polygon.coordinates.map((ring) =>
    ring.map(([x = 0, y = 0]): [number, number] => [x, y]),
  )

  const [lon = 0, lat = 0] = polylabel(rings, LABEL_PRECISION)

  return { coords: [lon, lat], bounds: ringBounds(outer) }
}

// The suburbs merged into one area, so the borders between them drop out.
function areaOf(
  topology: MapTopology,
  ids: Iterable<string>,
): RegionArea | undefined {
  const byId = suburbGeometries(topology)
  const geometries = [...ids].flatMap((id) => byId.get(id) ?? [])

  if (geometries.length === 0) {
    return undefined
  }

  const key = [...ids].toSorted().join(",")
  const cached = areaCache.get(key)

  if (cached) {
    return cached
  }

  const geometry = merge(topology, geometries)
  const area = { geometry, label: labelFor(geometry) }

  if (areaCache.size >= MAX_CACHED_AREAS) {
    areaCache.clear()
  }

  areaCache.set(key, area)

  return area
}

// Fills each region in its colour, outlines it as one area, and names it.
// Empty regions draw nothing.
export function regionLayers(
  map: RegionMap,
  { topology }: SuburbMapData,
): MapLayers {
  const layers: Required<MapLayers> = {
    fills: [],
    outlines: [],
    markers: [],
    labels: [],
  }

  for (const region of map.regions) {
    const area = areaOf(topology, region.suburbIds)

    if (!area) {
      continue
    }

    layers.fills.push({
      key: region.id,
      ids: new Set(region.suburbIds),
      color: region.color,
    })
    layers.outlines.push({
      key: region.id,
      feature: { type: "Feature", geometry: area.geometry, properties: {} },
    })

    if (area.label) {
      layers.labels.push({ key: region.id, text: region.name, ...area.label })
    }
  }

  return layers
}
