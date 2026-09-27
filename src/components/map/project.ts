import { geoMercator, geoPath } from "d3-geo"

import type { Bounds } from "@/lib/zoom"
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

export interface ProjectedMap {
  suburbs: ProjectedSuburb[]
  councils: ProjectedCouncil[]
  surrounds: string
  landuse: ProjectedLanduse[]
}

// Fits the suburbs to the viewport and projects everything to SVG path
// strings, bounding box sizes and label positions, all in unzoomed pixels.
export function projectMap(
  { suburbs, councils, surrounds, landuse }: SuburbMapData,
  width: number,
  height: number,
): ProjectedMap {
  const projection = geoMercator().fitSize([width, height], {
    type: "FeatureCollection",
    features: suburbs,
  })
  const path = geoPath(projection)
  return {
    suburbs: suburbs.map((s) => {
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
    }),
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
