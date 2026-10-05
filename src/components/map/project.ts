import { type GeoProjection, geoMercator, geoPath } from "d3-geo"

import type { Bounds } from "@/lib/zoom"
import type { MapLayers } from "@/types/map-layers"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

export interface ProjectedSuburb {
  id: string
  name: string
  d: string
  bounds: Bounds
  width: number
  height: number
  label: [number, number] | null
}

export interface ProjectedCouncil {
  lga: string
  d: string
  bounds: Bounds
}

export interface ProjectedLanduse {
  kind: LanduseKind
  d: string
}

export interface ProjectedFill {
  key: string
  d: string
  className: string
}

export interface ProjectedOutline {
  key: string
  d: string
}

export interface ProjectedMarker {
  key: string
  x: number
  y: number
  src: string
  label: string
}

export interface ProjectedMap {
  suburbs: ProjectedSuburb[]
  councils: ProjectedCouncil[]
  surrounds: string
  landuse: ProjectedLanduse[]
  fills: ProjectedFill[]
  outlines: ProjectedOutline[]
  markers: ProjectedMarker[]
}

// Fits the suburbs to the viewport and projects everything, layers
// included, to SVG path strings, bounding box sizes and label positions, all
// in unzoomed pixels.
export function projectMap(
  { suburbs, councils, surrounds, landuse }: SuburbMapData,
  layers: MapLayers,
  width: number,
  height: number,
): ProjectedMap {
  const projection = geoMercator().fitSize([width, height], {
    type: "FeatureCollection",
    features: suburbs,
  })
  const path = geoPath(projection)
  const projectedSuburbs = suburbs.map((s) => {
    const bounds = path.bounds(s)
    const [[x0, y0], [x1, y1]] = bounds
    return {
      id: s.properties.id,
      name: s.properties.name,
      d: path(s) ?? "",
      bounds,
      width: x1 - x0,
      height: y1 - y0,
      label: projection([s.properties.lx, s.properties.ly]),
    }
  })
  return {
    suburbs: projectedSuburbs,
    ...projectLayers(layers, projectedSuburbs, projection),
    councils: councils.map((c) => ({
      lga: c.properties.lga,
      d: path(c) ?? "",
      bounds: path.bounds(c),
    })),
    surrounds: path(surrounds) ?? "",
    landuse: landuse.map((l) => ({
      kind: l.properties.kind,
      d: path(l) ?? "",
    })),
  }
}

// Fills reuse the projected suburb paths.
function projectLayers(
  { fills, outlines, markers }: MapLayers,
  suburbs: ProjectedSuburb[],
  projection: GeoProjection,
): Pick<ProjectedMap, "fills" | "outlines" | "markers"> {
  const path = geoPath(projection)
  return {
    fills: fills.map((f) => ({
      key: f.key,
      className: f.className,
      d: suburbs
        .filter((s) => f.ids.has(s.id))
        .map((s) => s.d)
        .join(""),
    })),
    outlines: outlines.map((o) => ({ key: o.key, d: path(o.feature) ?? "" })),
    markers: markers.flatMap((m) => {
      const point = projection(m.coords)
      return point
        ? [{ key: m.key, x: point[0], y: point[1], src: m.src, label: m.label }]
        : []
    }),
  }
}
