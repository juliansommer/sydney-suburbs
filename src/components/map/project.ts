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
  image?: string
  // Each suburb's path on its own, for an image fill.
  parts: { id: string; d: string }[]
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

export interface ProjectedBase {
  projection: GeoProjection
  suburbs: ProjectedSuburb[]
  councils: ProjectedCouncil[]
  surrounds: string
  landuse: ProjectedLanduse[]
}

export interface ProjectedLayers {
  fills: ProjectedFill[]
  outlines: ProjectedOutline[]
  markers: ProjectedMarker[]
}

// Fits the suburbs to the viewport and projects the base map to SVG path
// strings, bounding box sizes and label positions, all in unzoomed pixels.
export function projectBase(
  { suburbs, councils, surrounds, landuse }: SuburbMapData,
  width: number,
  height: number,
): ProjectedBase {
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
    projection,
    suburbs: projectedSuburbs,
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

// Separate from the base so changing layers skips re-projecting every
// suburb. Fills reuse the projected suburb paths.
export function projectLayers(
  { fills, outlines, markers }: MapLayers,
  { suburbs, projection }: ProjectedBase,
): ProjectedLayers {
  const path = geoPath(projection)
  return {
    fills: fills.map((f) => {
      const parts = suburbs
        .filter((s) => f.ids.has(s.id))
        .map((s) => ({ id: s.id, d: s.d }))
      return {
        key: f.key,
        className: f.className,
        image: f.image,
        d: parts.map((p) => p.d).join(""),
        parts: f.image ? parts : [],
      }
    }),
    outlines: outlines.map((o) => ({ key: o.key, d: path(o.feature) ?? "" })),
    markers: markers.flatMap((m) => {
      const point = projection(m.coords)
      return point
        ? [{ key: m.key, x: point[0], y: point[1], src: m.src, label: m.label }]
        : []
    }),
  }
}
